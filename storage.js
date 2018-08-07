var vscode = require( 'vscode' );
var gistore = require( 'gistore' );
var utils = require( './utils' );

var lastRead = {};
var mutedChannels = {};
var mutedServers = {};
var lastSync = undefined;

var generalOutputChannel;

function initialize( outputChannel )
{
    generalOutputChannel = outputChannel;
    mutedChannels = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'mutedChannels', {} );
    mutedServers = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'mutedServers', {} );

    var token = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'syncToken', undefined );
    var gistId = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'syncGistId', undefined );

    if( token )
    {
        gistore.setToken( token );

        if( gistId )
        {
            gistore.setId( gistId );

            gistore.sync().then( function( data )
            {
                mutedServers = data.discordSync.mutedServers;
                mutedChannels = data.discordSync.mutedChannels;
                lastRead = data.discordSync.lastRead;
                lastSync = data.discordSync.lastSync;

                updateLastRead();
            } ).catch( function( error )
            {
                console.log( error );
            } );
        }
        else
        {
            var lastRead = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'lastRead', {} );

            gistore.createBackUp( 'discordSync',
                {
                    discordSync: {
                        mutedServers: mutedServers,
                        mutedChannels: mutedChannels,
                        lastRead: lastRead,
                        lastSync: new Date()
                    }
                } )
                .then( function( id )
                {
                    vscode.workspace.getConfiguration( 'discord-chat' ).update( 'syncGistId', id, true );
                } );
        }
    }
}

function sync()
{
    var token = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'syncToken', undefined );
    var gistId = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'syncGistId', undefined );

    if( token && gistId )
    {
        var now = new Date();

        gistore.backUp( {
            discordSync: {
                mutedServers: mutedServers,
                mutedChannels: mutedChannels,
                lastRead: lastRead,
                lastSync: now
            }
        } ).then( function()
        {
            generalOutputChannel.appendLine( "Synced at " + now.toISOString() );
        } ).catch( function( error )
        {
            console.log( error );
        } );
    }
}

function setLastRead( channel )
{
    var now = new Date().toISOString();

    lastRead[ channel.id.toString() ] = now;
    generalOutputChannel.appendLine( "Channel " + utils.toChannelName( channel ) + " (" + channel.id.toString() + ") read at " + now );

    sync();
}

function updateLastRead()
{
    vscode.workspace.getConfiguration( 'discord-chat' ).update( 'lastRead', lastRead, true );

    sync();
}

function getLastRead( channel )
{
    lastRead = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'lastRead', {} );
    return lastRead[ channel.id.toString() ];
}

function setServerMuted( server, muted )
{
    mutedServers[ server.id.toString() ] = muted;
    vscode.workspace.getConfiguration( 'discord-chat' ).update( 'mutedServers', mutedServers, true ).then( function()
    {
        mutedServers = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'mutedServers', {} );
    } );
    generalOutputChannel.appendLine( "Server " + server.name + ( muted ? " muted" : " unmuted" ) );

    sync();
}

function getServerMuted( server )
{
    return server.id && mutedServers[ server.id.toString() ];
}

function setChannelMuted( channel, muted )
{
    mutedChannels[ channel.id.toString() ] = muted;
    vscode.workspace.getConfiguration( 'discord-chat' ).update( 'mutedChannels', mutedChannels, true ).then( function()
    {
        mutedChannels = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'mutedChannels', {} );
    } );
    generalOutputChannel.appendLine( "Channel " + utils.toChannelName( channel ) + ( muted ? " muted" : " unmuted" ) );

    sync();
}

function getChannelMuted( channel )
{
    return mutedChannels[ channel.id.toString() ];
}

function isChannelMuted( channel )
{
    mutedChannels = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'mutedChannels', {} );
    return getServerMuted( channel.guild ) === true || getChannelMuted( channel );
}

module.exports.initialize = initialize;

module.exports.setLastRead = setLastRead;
module.exports.updateLastRead = updateLastRead;
module.exports.getLastRead = getLastRead;

module.exports.setServerMuted = setServerMuted;
module.exports.getServerMuted = getServerMuted;

module.exports.setChannelMuted = setChannelMuted;
module.exports.getChannelMuted = getChannelMuted;
module.exports.isChannelMuted = isChannelMuted;
