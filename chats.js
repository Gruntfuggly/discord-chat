var strftime = require( 'strftime' );
var utils = require( './utils' );

var messages = {};

function sanitizeUnicode( entries )
{
    entries = entries.map( function( entry )
    {
        entry = entry.replace( /’/g, '\'' );
        entry = entry.replace( /‘/g, '\'' );
        entry = entry.replace( /“/g, '"' );
        entry = entry.replace( /”/g, '"' );
        entry = entry.replace( /–/g, '-' );
        entry = entry.replace( /—/g, '-' );
        return entry;
    } );
    return entries;
}

function formatMessage( message, compact, short )
{
    function separator()
    {
        return compact === true ? ": " : ":\n ";
    }

    function content( text )
    {
        return text.split( '\n' ).join( compact ? "\n" : "\n " );
    }

    function isCode( text )
    {
        var codeRegex = new RegExp( "```(.+)\n((.*\n)*)```" );
        var result = codeRegex.exec( text );
        return result;
    }

    var entries = [];

    var format = "%a %T";
    if( short )
    {
        format = "%H:%M";
    }
    else if( new Date() - message.createdAt > 1000 * 60 * 60 * 24 * 7 )
    {
        format = "%D %T";
    }

    var header =
        strftime( format, message.createdAt ) +
        ( short ? ( " [" + utils.toServerName( message.channel ) + "/" + utils.toChannelName( message.channel ) + "]" ) : "" ) +
        " @" + message.author.username;

    if( message.author )
    {
        var code = isCode( message.content );

        if( message.type == "GUILD_MEMBER_JOIN" )
        {
            entries.push( header + " joined" );
        }
        else if( code )
        {
            entries.push( header + " posted some " + code[ 1 ] + " code:\n" + code[ 2 ] );
        }
        else if( message.cleanContent )
        {
            entries.push( header + separator() + content( message.cleanContent ) );
        }
        else if( message.content )
        {
            entries.push( header + separator() + content( message.content ) );
        }
        else if( message.embeds.length > 0 )
        {
            message.embeds.map( function( embed )
            {
                if( embed.image )
                {
                    entries.push( header + " embedded image " + embed.image.url + " (" + embed.description + ")" );
                }
                if( embed.video )
                {
                    entries.push( header + " embedded video " + embed.video.url + " (" + embed.description + ")" );
                }
            } );
        }

        if( message.attachments )
        {
            message.attachments.map( function( attachment )
            {
                entries.push( header + " attached " + attachment.url );
            } );
        }

        if( compact !== true && short !== true )
        {
            entries.push( "" );
        }
    }

    entries = sanitizeUnicode( entries );

    return entries;
}

function addMessage( id, message, timeOfMessage )
{
    if( messages[ id ] === undefined )
    {
        messages[ id ] = [];
    }

    message.map( function( line )
    {
        messages[ id ].push( { text: line, timeOfMessage: timeOfMessage, read: false } );
    } );
}

function chatRead( id, time )
{
    if( messages[ id ] )
    {
        messages[ id ].forEach( function( message )
        {
            message.read = message.timeOfMessage < time;
        } );
    }
}

function getReadMessages( id )
{
    if( messages[ id ] )
    {
        return messages[ id ].filter( function( message )
        {
            return message.read === true;
        } ).map( message => message.text );

    }
    return [];
}

function getUnreadMessages( id )
{
    if( messages[ id ] )
    {
        return messages[ id ].filter( function( message )
        {
            return message.read === false;
        } ).map( message => message.text );
    }
    return [];
}

module.exports.formatMessage = formatMessage;
module.exports.addMessage = addMessage;
module.exports.chatRead = chatRead;
module.exports.getReadMessages = getReadMessages;
module.exports.getUnreadMessages = getUnreadMessages;
