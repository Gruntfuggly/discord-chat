var vscode = require( 'vscode' );
var gistore = require( 'gistore' );
var utils = require( './utils' );

var lastSync = undefined;

var generalOutputChannel;
var state;
var backupTimer;

function sync( callback )
{
    if( gistore.token )
    {
        gistore.sync().then( function( data )
        {
            var now = new Date();

            generalOutputChannel.appendLine( "Sync at " + now.toISOString() );

            if( lastSync === undefined || data.discordSync.lastSync > lastSync )
            {
                state.update( 'mutedServers', data.discordSync.mutedServers );
                state.update( 'mutedChannels', data.discordSync.mutedChannels );
                state.update( 'lastRead', data.discordSync.lastRead );
                state.update( 'lastSync', data.discordSync.lastSync );
            }

            if( callback )
            {
                callback();
            }
        } ).catch( function( error )
        {
            console.error( "sync failed:" + error );

            if( callback )
            {
                callback();
            }
        } );
    }
    else
    {
        callback();
    }
}

function initializeSync()
{
    var token = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'syncToken', undefined );
    var gistId = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'syncGistId', undefined );

    if( token )
    {
        gistore.setToken( token );

        if( gistId )
        {
            gistore.setId( gistId );

            sync();
        }
        else
        {
            gistore.createBackUp( 'discordSync',
                {
                    discordSync: {
                        mutedServers: state.get( 'mutedServers' ),
                        mutedChannels: state.get( 'mutedChannels' ),
                        lastRead: state.get( 'lastRead' ),
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

function migrateSettings()
{
    state.update( 'mutedChannels', vscode.workspace.getConfiguration( 'discord-chat' ).get( 'mutedChannels', {} ) );
    state.update( 'mutedServers', vscode.workspace.getConfiguration( 'discord-chat' ).get( 'mutedServers', {} ) );
    state.update( 'lastRead', vscode.workspace.getConfiguration( 'discord-chat' ).get( 'lastRead', {} ) );

    vscode.workspace.getConfiguration( 'discord-chat' ).update( 'lastRead', undefined, true );
    vscode.workspace.getConfiguration( 'discord-chat' ).update( 'mutedServers', undefined, true );
    vscode.workspace.getConfiguration( 'discord-chat' ).update( 'mutedChannels', undefined, true );

    state.update( 'migrated', true );
}

function initialize( outputChannel, workspaceState )
{
    generalOutputChannel = outputChannel;
    state = workspaceState;

    initializeSync();

    if( state.get( 'migrated' ) !== true )
    {
        migrateSettings();
    }
}

function backup()
{
    if( gistore.token )
    {
        var now = new Date();

        gistore.backUp( {
            discordSync: {
                mutedServers: state.get( 'mutedServers' ),
                mutedChannels: state.get( 'mutedChannels' ),
                lastRead: state.get( 'lastRead' ),
                lastSync: now
            }
        } ).then( function()
        {
            generalOutputChannel.appendLine( "Backup at " + now.toISOString() );
        } ).catch( function( error )
        {
            console.error( "backup failed: " + error );
            triggerBackup();
        } );
    }
}

function triggerBackup()
{
    generalOutputChannel.appendLine( "Backing up in 1 second..." );
    clearTimeout( backupTimer );
    backupTimer = setTimeout( backup, 1000 );
}

function setLastRead( channel )
{
    var now = new Date().toISOString();
    var lastRead = state.get( 'lastRead' );
    lastRead[ channel.id.toString() ] = now;
    state.update( 'lastRead', lastRead );
    triggerBackup();
    generalOutputChannel.appendLine( "Channel " + utils.toChannelName( channel ) + " (" + channel.id.toString() + ") read at " + now );
}

function getLastRead( channel )
{
    return state.get( 'lastRead' )[ channel.id.toString() ];
}

function setServerMuted( server, muted )
{
    var mutedServers = state.get( 'mutedServers' );
    mutedServers[ server.id.toString() ] = muted;
    state.update( 'mutedServers', mutedServers );
    triggerBackup();
    generalOutputChannel.appendLine( "Server " + server.name + ( muted ? " muted" : " unmuted" ) );
}

function getServerMuted( server )
{
    return server && server.id && state.get( 'mutedServers' )[ server.id.toString() ];
}

function setChannelMuted( channel, muted )
{
    var mutedChannels = state.get( 'mutedChannels' );
    mutedChannels[ channel.id.toString() ] = muted;
    state.update( 'mutedChannels', mutedChannels );
    triggerBackup();
    generalOutputChannel.appendLine( "Channel " + utils.toChannelName( channel ) + ( muted ? " muted" : " unmuted" ) );
}

function getChannelMuted( channel )
{
    return state.get( 'mutedChannels' )[ channel.id.toString() ];
}

function isChannelMuted( channel )
{
    return getServerMuted( channel.guild ) === true || getChannelMuted( channel );
}

function resetSync()
{
    if( gistore.token )
    {
        var now = new Date();

        gistore.backUp( {
            discordSync: {
                mutedServers: {},
                mutedChannels: {},
                lastSync: now
            }
        } ).then( function()
        {
            generalOutputChannel.appendLine( "Reset sync at " + now.toISOString() );
            sync();
        } ).catch( function( error )
        {
            console.error( "reset failed: " + error );
        } );
    }
}

function resetState()
{
    state.update( 'mutedServers', {} );
    state.update( 'mutedChannels', {} );
}

module.exports.initialize = initialize;

module.exports.setLastRead = setLastRead;
module.exports.getLastRead = getLastRead;

module.exports.setServerMuted = setServerMuted;
module.exports.getServerMuted = getServerMuted;

module.exports.setChannelMuted = setChannelMuted;
module.exports.getChannelMuted = getChannelMuted;
module.exports.isChannelMuted = isChannelMuted;

module.exports.initializeSync = initializeSync;
module.exports.sync = sync;
module.exports.resetSync = resetSync;
module.exports.resetState = resetState;