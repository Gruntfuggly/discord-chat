var vscode = require( 'vscode' );
var utils = require( './utils' );
var chats = require( './chats' );

var client;
var outputChannels = {};
var visibleEditors = [];
var decorations = [];

var oldMessageMask = vscode.window.createTextEditorDecorationType( { textDecoration: 'none; opacity: 0.6' } );

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
    else
    {
    }
}

function getDiscordChannel( id )
{
    return outputChannels[ id ] && outputChannels[ id ].discordChannel;
}

function findOutputChannel( filename, action )
{
    Object.keys( outputChannels ).forEach( function( c )
    {
        if( outputChannels[ c ].outputChannel._id === filename )
        {
            action( outputChannels[ c ].outputChannel, c );
        }
    } );
}

function getChannelId( filename )
{
    var result;
    Object.keys( outputChannels ).forEach( c =>
    {
        if( outputChannels[ c ].outputChannel._id === filename )
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
        findOutputChannel( outputChannel._id, function( channel, id )
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
        outputChannels[ id ].autoHideTimer = setTimeout( hideOutputChannel, period, outputChannels[ id ].outputChannel );
    }
}

function cancelAutoHide( channel )
{
    Object.keys( outputChannels ).forEach( function( id )
    {
        if( outputChannels[ id ].discordChannel === channel )
        {
            clearTimeout( outputChannels[ id ].autoHideTimer );
        }
    } );
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

function remove( id )
{
    if( outputChannels[ id ] )
    {
        outputChannels[ id ].outputChannel.dispose();
    }
    delete outputChannels[ id ];
}

function updateVisibleEditors( editors, onVisible, onNotVisible )
{
    visibleEditors = editors;

    var visible = false;
    visibleEditors.map( function( editor )
    {
        Object.keys( outputChannels ).map( function( id )
        {
            if( editor.document && editor.document.fileName === outputChannels[ id ].outputChannel._id )
            {
                visible = true;
                onVisible();
                // TODO reveal
                autoHide( id );
            }
        } );
    } );
    if( visible === false )
    {
        onNotVisible();
    }
}

function isOutputChannelVisible( id )
{
    var visible = false;
    if( outputChannels[ id ] !== undefined )
    {
        visibleEditors.map( function( editor )
        {
            if( editor.document && editor.document.fileName === outputChannels[ id ].outputChannel._id )
            {
                visible = true;
            }
        } );
    }
    return visible;
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
module.exports.remove = remove;
module.exports.updateVisibleEditors = updateVisibleEditors;
module.exports.isOutputChannelVisible = isOutputChannelVisible;
module.exports.fadeOldMessages = fadeOldMessages;
module.exports.highlightUserNames = highlightUserNames;