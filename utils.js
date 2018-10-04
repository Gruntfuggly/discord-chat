var https = require( 'https' );
var fs = require( 'fs' );
var path = require( 'path' );

var fetchedIcons = {};

var generalOutputChannel;

var directMessagesServerName = function()
{
    return "Direct Messages";
}

function initialize( outputChannel )
{
    generalOutputChannel = outputChannel
}

function log( text )
{
    if( generalOutputChannel )
    {
        generalOutputChannel.appendLine( new Date().toLocaleTimeString() + " " + text );
    }
    else
    {
        console.log( text );
    }
}

function toParentId( channel )
{
    if( !channel )
    {
        return undefined;
    }

    if( channel.guild )
    {
        return channel.guild.id.toString();
    }

    return "directMessages";
}

function toServerName( channel )
{
    if( !channel )
    {
        return undefined;
    }

    return channel.guild ? channel.guild.name : directMessagesServerName();
}

function toChannelName( channel )
{
    if( !channel )
    {
        return undefined;
    }

    var name = channel.name;
    if( !name )
    {
        if( channel.type === "dm" )
        {
            name = "@" + channel.recipient.username;
        }
        else if( channel.type === "group" )
        {
            var names = [];
            channel.recipients.map( recipient =>
            {
                names.push( "@" + recipient.username );
            } );
            name = names.join( ", " );
        }
    }
    return name;
}


function toOutputChannelName( channel )
{
    if( !channel )
    {
        return undefined;
    }

    var name = 'discord-chat.';
    if( channel.guild )
    {
        name += channel.guild.name;
        name += '.' + channel.name;
    }
    else
    {
        name += "dm";
        name += '.' + toChannelName( channel );
    }

    return name;
}

function toHash( text )
{
    var hash = 0;
    for( var i = 0; i < text.length; i++ )
    {
        hash = text.charCodeAt( i ) + ( ( hash << 5 ) - hash );
    }
    return hash;
}

var toDarkColour = function( text )
{
    var colour = '#';
    var hash = toHash( text );
    for( var i = 0; i < 3; i++ )
    {
        var value = ( hash >> ( i * 4 ) ) & 0x80;
        colour += ( '00' + value.toString( 16 ) ).substr( -2 );
    }
    return colour;
}

var toLightColour = function( text )
{
    var hash = toHash( text );
    var colour = '#';
    for( var i = 0; i < 3; i++ )
    {
        var value = ( ( hash >> ( i * 4 ) ) & 0x7f ) + 0x80;
        colour += ( '00' + value.toString( 16 ) ).substr( -2 );
    }
    return colour;
}

var isReadableChannel = function( user, channel )
{
    if( channel && user )
    {
        if( channel.type === 'dm' )
        {
            return true;
        }
        else if( channel.type === 'group' )
        {
            return channel.recipients.size > 0;
        }
        else if( channel.type === 'text' )
        {
            var permissions = channel.permissionsFor( user );
            return permissions.has( "VIEW_CHANNEL" )
        }
    }
    return false;
}

function fetchIcon( url, filename, callback )
{
    if( !fetchedIcons[ url ] )
    {
        var file = fs.createWriteStream( filename );
        var request = https.get( url, function( response )
        {
            response.pipe( file );
            file.on( 'finish', function()
            {
                fetchedIcons[ url ] = true;
                file.close( callback );  // close() is async, call cb after close completes.
            } );
        } );
    }
    else
    {
        callback();
    }
}

function urlExt( url )
{
    var filePath = url;
    var queryIndex = filePath.indexOf( '?' );
    if( queryIndex > -1 )
    {
        filePath = filePath.substr( 0, queryIndex );
    }
    return path.extname( filePath );
}


function setVisibleEditors( editors )
{
    visibleEditors = editors;
}

function outputChannelVisible()
{
    currentVisibleEditors.map( function( editor )
    {
        Object.keys( outputChannels ).map( function( id )
        {
            if( editor.document && editor.document.fileName === outputChannels[ id ].outputChannel._id )
            {
                outptuChannelVisible = true;
                // TODO reveal
                updateSelectionState();
                decorateOutputChannel();
                setAutoClose( id );
            }
        } );
    } );
}

module.exports.initialize = initialize;
module.exports.log = log;
module.exports.toParentId = toParentId;
module.exports.toServerName = toServerName;
module.exports.toChannelName = toChannelName;
module.exports.toOutputChannelName = toOutputChannelName;
module.exports.toDarkColour = toDarkColour;
module.exports.toLightColour = toLightColour;
module.exports.isReadableChannel = isReadableChannel;
module.exports.directMessagesServerName = directMessagesServerName;
module.exports.fetchIcon = fetchIcon;
module.exports.urlExt = urlExt;
module.exports.setVisibleEditors = setVisibleEditors;