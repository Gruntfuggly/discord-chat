var outputChannels = {};

function create()
{
}

function get()
{
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

function findOutputChannel( filename, action )
{
    Object.keys( outputChannels ).forEach( c =>
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

module.exports.create = create;
module.exports.get = get;
module.exports.outputChannel = outputChannel;
module.exports.getDiscordChannel = getDiscordChannel;
module.exports.findOutputChannel = findOutputChannel;
module.exports.getChannelId = getChannelId;