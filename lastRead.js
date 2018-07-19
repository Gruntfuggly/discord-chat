var vscode = require( 'vscode' );
var utils = require( './utils' );

var lastRead = {};

var generalOutputChannel;

function initialize( outputChannel )
{
    generalOutputChannel = outputChannel;
}

function setLastRead( channel )
{
    var now = new Date().toISOString();;

    lastRead[ channel.id ] = now;
    generalOutputChannel.appendLine( "Channel " + utils.toChannelName( channel ) + " (" + channel.id + ") read at " + now );
}

function updateLastRead()
{
    vscode.workspace.getConfiguration( 'discord-chat' ).update( 'lastRead', lastRead, true );
}

function getLastRead( channel )
{
    lastRead = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'lastRead', {} );
    return lastRead[ channel.id ];
}

module.exports.initialize = initialize;
module.exports.setLastRead = setLastRead;
module.exports.updateLastRead = updateLastRead;
module.exports.getLastRead = getLastRead;
