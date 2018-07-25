var vscode = require( 'vscode' );
var utils = require( './utils' );

var lastRead = {};
var mutedChannels = {};
var mutedServers = {};

var generalOutputChannel;

function initialize( outputChannel )
{
    generalOutputChannel = outputChannel;
}

function setLastRead( channel )
{
    var now = new Date().toISOString();;

    lastRead[ channel.id.toString() ] = now;
    generalOutputChannel.appendLine( "Channel " + utils.toChannelName( channel ) + " (" + channel.id.toString() + ") read at " + now );
}

function updateLastRead()
{
    vscode.workspace.getConfiguration( 'discord-chat' ).update( 'lastRead', lastRead, true );
}

function getLastRead( channel )
{
    lastRead = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'lastRead', {} );
    return lastRead[ channel.id.toString() ];
}

function setChannelMuted( channel, muted )
{
    mutedChannels[ channel.id.toString() ] = muted;
    vscode.workspace.getConfiguration( 'discord-chat' ).update( 'mutedChannels', mutedChannels, true );
    generalOutputChannel.appendLine( "Channel " + utils.toChannelName( channel ) + ( muted ? " muted" : " unmuted" ) );
}

function getChannelMuted( channel )
{
    mutedChannels = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'mutedChannels', {} );
    return mutedChannels[ channel.id.toString() ];
}

function setServerMuted( server, muted )
{
    mutedServers[ server.id.toString() ] = muted;
    vscode.workspace.getConfiguration( 'discord-chat' ).update( 'mutedServers', mutedServers, true );
    generalOutputChannel.appendLine( "Server " + server.name + ( muted ? " muted" : " unmuted" ) );
}

function getServerMuted( server )
{
    mutedServers = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'mutedServers', {} );
    return mutedServers[ server.id.toString() ];
}

module.exports.initialize = initialize;

module.exports.setLastRead = setLastRead;
module.exports.updateLastRead = updateLastRead;
module.exports.getLastRead = getLastRead;

module.exports.setChannelMuted = setChannelMuted;
module.exports.getChannelMuted = getChannelMuted;

module.exports.setServerMuted = setServerMuted;
module.exports.getServerMuted = getServerMuted;
