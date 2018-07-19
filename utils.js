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


module.exports.toParentId = toParentId;
module.exports.toServerName = toServerName;
module.exports.toChannelName = toChannelName;
module.exports.toOutputChannelName = toOutputChannelName;