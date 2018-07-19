function toParentId( channel )
{
    if( channel.guild )
    {
        return channel.guild.id;
    }
    return channel.ownerID;
}

function toServerName( channel )
{
    return channel.guild ? channel.guild.name : "Direct Messages";
}

function toChannelName( channel )
{
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
    var name = 'discord-chat.';
    if( channel.guild )
    {
        name += channel.guild.name;
    }
    else
    {
        name += "dm";
    }
    name += '.' + channel.name;

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

module.exports.toParentId = toParentId;
module.exports.toServerName = toServerName;
module.exports.toChannelName = toChannelName;
module.exports.toOutputChannelName = toOutputChannelName;
module.exports.toDarkColour = toDarkColour;
module.exports.toLightColour = toLightColour;