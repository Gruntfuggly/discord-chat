var vscode = require( 'vscode' );

var generalOutputChannel;

function initialize( outputChannel )
{
    generalOutputChannel = outputChannel;
}

function setLastRead( channel )
{
    var now = new Date().toISOString();;

    var lastRead = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'lastRead', {} );
    lastRead[ channel.id ] = now;
    vscode.workspace.getConfiguration( 'discord-chat' ).update( 'lastRead', lastRead, true );

    generalOutputChannel.appendLine( "Channel " + channel.guild.name + "." + channel.name + " read at " + now );
}

function getLastRead( channel )
{
    var lastRead = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'lastRead', {} );
    return lastRead[ channel.id ];
}

module.exports.initialize = initialize;
module.exports.setLastRead = setLastRead;
module.exports.getLastRead = getLastRead;
