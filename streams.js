var vscode = require( 'vscode' );
var utils = require( './utils' );
var chats = require( './chats' );

var client;
var outputChannels = {};
var visibleEditors = [];
var decorations = [];

var oldMessageMask = vscode.window.createTextEditorDecorationType( { textDecoration: 'none; opacity: 0.6' } );

function getOutputChannelId( outputChannel )
{
    var id = outputChannel._id;
    return id._value ? id._value : id;
}

function initialize( discordClient )
{
    client = discordClient;
}

function getDecoration( tag )
{
    return vscode.window.createTextEditorDecorationType( {
        light: { color: utils.toDarkColour( tag ) },
        dark: { color: utils.toLightColour( tag ) },
    } );
}

function outputChannel( id, action )
{
    if( outputChannels[ id ] && outputChannels[ id ].outputChannel )
    {
        action( outputChannels[ id ].outputChannel );
    }
}

function getDiscordChannel( id )
{
    return outputChannels[ id ] && outputChannels[ id ].discordChannel;
}

function findOutputChannel( outputChannel, action )
{
    Object.keys( outputChannels ).forEach( function( c )
    {
        if( getOutputChannelId( outputChannels[ c ].outputChannel ) === getOutputChannelId( outputChannel ) )
        {
            action( outputChannels[ c ].outputChannel, c );
        }
    } );
}

function getChannelId( filename )
{
    var result;
    Object.keys( outputChannels ).forEach( function( c )
    {
        if( getOutputChannelId( outputChannels[ c ].outputChannel ) === filename )
        {
            result = c;
        }
    } );
    return result;
}

function autoHide( id )
{
    function hideOutputChannel( outputChannel )
    {
        findOutputChannel( outputChannel, function( channel, id )
        {
            if( isOutputChannelVisible( id ) )
            {
                outputChannel.hide();
            }
        } );
    }

    if( outputChannels[ id ] )
    {
        var timer = outputChannels[ id ].autoHideTimer;
        if( timer )
        {
            clearTimeout( timer );
        }
        var period = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'autoHide' ) * 1000;
        if( period > 0 )
        {
            utils.log( "Auto hiding in " + period + " milliseconds" );
            outputChannels[ id ].autoHideTimer = setTimeout( hideOutputChannel, period, outputChannels[ id ].outputChannel );
        }
    }
}

function cancelAutoHide( id )
{
    if( outputChannels[ id ] )
    {
        utils.log( "Auto hide cancelled" );
        clearTimeout( outputChannels[ id ].autoHideTimer );
    }
}

function open( channel, subscriptions, populate, callback )
{
    var id = channel.id.toString();
    var outputChannel = outputChannels[ id ];
    if( !outputChannel )
    {
        outputChannel = vscode.window.createOutputChannel( utils.toOutputChannelName( channel ) + "." + id );
        outputChannel.clear();
        outputChannels[ id ] = {
            outputChannel: outputChannel,
            discordChannel: channel,
        };

        subscriptions.push( outputChannel );

        populate( channel );
    }
    else
    {
        outputChannel = outputChannel.outputChannel;
    }

    outputChannel.show( true );
    callback( channel );
}

function reset( channelId )
{
    if( channelId === undefined )
    {
        Object.keys( outputChannels ).map( function( id )
        {
            outputChannels[ id ].outputChannel.clear();
        } );
    }
    else
    {
        outputChannels[ channelId ].outputChannel.clear();
    }
}

function remove( id )
{
    if( outputChannels[ id ] )
    {
        outputChannels[ id ].outputChannel.dispose();
    }
    delete outputChannels[ id ];
}

function updateVisibleEditors( editors, onVisible, onNoLongerVisible )
{
    var previouslyVisible = [];
    Object.keys( outputChannels ).map( function( id )
    {
        visibleEditors.map( function( editor )
        {
            if( editor.document && editor.document.fileName === getOutputChannelId( outputChannels[ id ].outputChannel ) )
            {
                previouslyVisible.push( id );
            }
        } );
    } );

    visibleEditors = editors;

    editors.map( function( editor )
    {
        Object.keys( outputChannels ).map( function( id )
        {
            if( editor.document && editor.document.fileName === getOutputChannelId( outputChannels[ id ].outputChannel ) )
            {
                onVisible( outputChannels[ id ].discordChannel );
                autoHide( id );
            }
        } );
    } );


    Object.keys( outputChannels ).map( function( id )
    {
        var visible = false;
        editors.map( function( editor )
        {
            if( editor.document && editor.document.fileName === getOutputChannelId( outputChannels[ id ].outputChannel ) )
            {
                visible = true;
            }
        } );
        if( visible === false )
        {
            if( previouslyVisible.indexOf( id ) > -1 )
            {
                onNoLongerVisible( outputChannels[ id ].discordChannel );
            }
        }
    } );
}

function isOutputChannelVisible( id )
{
    var visible = false;
    if( outputChannels[ id ] !== undefined )
    {
        visibleEditors.map( function( editor )
        {
            if( editor.document && editor.document.fileName === getOutputChannelId( outputChannels[ id ].outputChannel ) )
            {
                visible = true;
            }
        } );
    }
    return visible;
}

function hideOutputChannel()
{
    visibleEditors.map( function( editor )
    {
        Object.keys( outputChannels ).map( function( id )
        {
            if( editor.document && editor.document.fileName === getOutputChannelId( outputChannels[ id ].outputChannel ) )
            {
                outputChannels[ id ].outputChannel.hide();
            }
        } );
    } );
}

function fadeOldMessages()
{
    visibleEditors.map( function( editor )
    {
        if( editor.document && editor.document.uri && editor.document.uri.scheme === 'output' )
        {
            var channelId = getChannelId( editor.document.fileName );
            var length = chats.getReadMessages( channelId ).reduce( ( total, value ) => total += ( value.length + 1 ), 0 );

            var fullRange = new vscode.Range(
                editor.document.positionAt( 0 ),
                editor.document.positionAt( length - 1 )
            );
            editor.setDecorations( oldMessageMask, [ fullRange ] );
        }
    } );
}

function highlightUserNames()
{
    function escapeRegExp( str )
    {
        return str.replace( /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&" );
    }

    visibleEditors.map( function( editor )
    {
        if( editor.document && editor.document.uri && editor.document.uri.scheme === 'output' )
        {
            var highlights = {};

            var text = editor.document.getText();
            var userList = [];
            if( client.users.size )
            {
                client.users.map( function( user )
                {
                    userList.push( escapeRegExp( "@" + user.username ) );
                } );
                var regex = new RegExp( "(" + userList.join( "|" ) + ")", 'g' );
                var match;
                while( ( match = regex.exec( text ) ) !== null )
                {
                    var tag = match[ match.length - 1 ];
                    var startPos = editor.document.positionAt( match.index );
                    var endPos = editor.document.positionAt( match.index + match[ 0 ].length );
                    var decoration = { range: new vscode.Range( startPos, endPos ) };
                    if( highlights[ tag ] === undefined )
                    {
                        highlights[ tag ] = [];
                    }
                    highlights[ tag ].push( decoration );
                }
                decorations.map( function( decoration )
                {
                    decoration.dispose();
                } );
                Object.keys( highlights ).map( function( tag )
                {
                    var decoration = getDecoration( tag );
                    decorations.push( decoration );
                    editor.setDecorations( decoration, highlights[ tag ] );
                } );
            }
        }
    } );
}

module.exports.initialize = initialize;
module.exports.outputChannel = outputChannel;
module.exports.getDiscordChannel = getDiscordChannel;
module.exports.findOutputChannel = findOutputChannel;
module.exports.getChannelId = getChannelId;
module.exports.autoHide = autoHide;
module.exports.cancelAutoHide = cancelAutoHide;
module.exports.open = open;
module.exports.reset = reset;
module.exports.remove = remove;
module.exports.updateVisibleEditors = updateVisibleEditors;
module.exports.isOutputChannelVisible = isOutputChannelVisible;
module.exports.hideOutputChannel = hideOutputChannel;
module.exports.fadeOldMessages = fadeOldMessages;
module.exports.highlightUserNames = highlightUserNames;