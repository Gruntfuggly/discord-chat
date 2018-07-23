var directMessagesServerName = function()
{
    return "Direct Messages";
}

function toParentId( channel )
{
    if( !channel )
    {
        return undefined;
    }

    if( channel.guild )
    {
        return channel.guild.id;
    }
    return channel.ownerID;
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
        var names = [];
        channel.recipients.map( recipient =>
        {
            names.push( recipient.username );
        } );
        name = names.join( ", " );
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

var isReadableChannel = function( channel )
{
    return channel.type === 'text' || channel.type === 'dm' || channel.type === 'group';
}

module.exports.toParentId = toParentId;
module.exports.toServerName = toServerName;
module.exports.toChannelName = toChannelName;
module.exports.toOutputChannelName = toOutputChannelName;
module.exports.toDarkColour = toDarkColour;
module.exports.toLightColour = toLightColour;
module.exports.isReadableChannel = isReadableChannel;
module.exports.directMessagesServerName = directMessagesServerName;