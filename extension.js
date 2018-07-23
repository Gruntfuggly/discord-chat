/* jshint esversion:6 */

var discord = require( 'discord.js' );
var strftime = require( 'strftime' );
var vscode = require( 'vscode' );
var https = require( 'https' );
var fs = require( 'fs' );
var path = require( 'path' );

var lastRead = require( './lastRead' );
var treeView = require( './dataProvider' );
var utils = require( './utils' );

var outputChannels = {};
var currentServer;
var currentChannel;
var decorations = [];
var highlightTimeout;

function activate( context )
{
    const client = new discord.Client();

    var provider = new treeView.DiscordChatDataProvider( context );
    var generalOutputChannel = vscode.window.createOutputChannel( 'discord-chat' );

    lastRead.initialize( generalOutputChannel );

    function fetchIcon( url, filename, cb )
    {
        var file = fs.createWriteStream( filename );
        var request = https.get( url, function( response )
        {
            response.pipe( file );
            file.on( 'finish', function()
            {
                file.close( cb );  // close() is async, call cb after close completes.
            } );
        } );
    }

    function getDecoration( tag )
    {
        return vscode.window.createTextEditorDecorationType( {
            light: { color: utils.toDarkColour( tag ) },
            dark: { color: utils.toLightColour( tag ) },
        } );
    }

    function formatMessage( message )
    {
        var compact = vscode.workspace.getConfiguration( 'discord-chat' ).compactView;

        function separator()
        {
            return compact === true ? ": " : ":\n ";
        }

        function content( text )
        {
            return text.split( '\n' ).join( compact ? "\n" : "\n " );
        }

        var entries = [];

        var timestamp = strftime( "%a %H:%M:%S", new Date( message.createdAt ) );

        if( message.type == "GUILD_MEMBER_JOIN" )
        {
            entries.push( timestamp + " @" + message.author.username + " joined" );
        }
        else if( message.cleanContent )
        {
            entries.push( timestamp + " @" + message.author.username + separator() + content( message.cleanContent ) );
        }
        else if( message.content )
        {
            entries.push( timestamp + " @" + message.author.username + separator() + content( message.content ) );
        }

        message.attachments.map( function( attachment )
        {
            entries.push( timestamp + " @" + message.author.username + " attached " + attachment.url );
        } );

        return entries;
    }

    function login()
    {
        generalOutputChannel.appendLine( "Logging in..." );

        var token = vscode.workspace.getConfiguration( 'discord-chat' ).token;
        if( token )
        {
            client.login( token ).then( function()
            {
            } ).catch( function( reason )
            {
                generalOutputChannel.appendLine( reason );
            } );
        }
        else
        {
            vscode.window.showInformationMessage( "Please set discord-chat.token (see https://discordhelp.net/discord-token)" );
        }
    }

    function updateSelectionState()
    {
        vscode.commands.executeCommand( 'setContext', 'discord-channel-selected', currentChannel !== undefined );
        vscode.commands.executeCommand( 'setContext', 'discord-server-selected', currentServer !== undefined );
    }

    function populateChannel( channel, done )
    {
        var entries = [];
        var options = {
            limit: vscode.workspace.getConfiguration( 'discord-chat' ).history,
        };

        if( outputChannels[ channel.id ].lastMessage )
        {
            options.after = outputChannels[ channel.id ].lastMessage.id;
        }

        channel.fetchMessages( options ).then( function( messages )
        {
            if( messages.size > 0 )
            {
                outputChannels[ channel.id ].lastMessage = messages.values().next().value;
            }

            messages.map( function( message )
            {
                entries = entries.concat( formatMessage( message ) );
                if( vscode.workspace.getConfiguration( 'discord-chat' ).compactView !== true )
                {
                    entries.push( "" );
                }
            } );

            entries.reverse().map( function( entry )
            {
                outputChannels[ channel.id ].outputChannel.appendLine( entry );
            } );

            provider.markRead( channel );

            done();
        } ).catch( function( e )
        {
            console.log( e );
        } );
    }

    function refresh()
    {
        var pending = client.guilds.size;
        var icons = {};

        function checkFinished()
        {
            --pending;
            if( pending === 0 )
            {
                provider.setIcons( icons );
                provider.populate( client.channels );
                provider.refresh();
            }
        }

        if( client.readyAt === null )
        {
            login();
        }
        else
        {
            var storagePath = context.storagePath;
            if( context.storagePath && !fs.existsSync( context.storagePath ) )
            {
                fs.mkdirSync( context.storagePath );
            }

            client.guilds.map( guild =>
            {
                if( guild.iconURL )
                {
                    var filename = path.join( storagePath, guild.id + path.extname( guild.iconURL ) );
                    generalOutputChannel.appendLine( "Fetching icon " + guild.iconURL );
                    icons[ guild.id ] = filename;
                    fetchIcon( guild.iconURL, filename, checkFinished );
                }
                else
                {
                    checkFinished();
                }
            } );
        }
    }

    function triggerHighlight()
    {
        clearTimeout( highlightTimeout );
        highlightTimeout = setTimeout( highlightUsers, vscode.workspace.getConfiguration( 'discord-chat' ).get( 'highlightDelay', 500 ) );
    }

    function highlightUsers()
    {
        var visibleEditors = vscode.window.visibleTextEditors;

        visibleEditors.map( editor =>
        {
            if( editor.document && editor.document.uri && editor.document.uri.scheme === 'output' )
            {
                var highlights = {};

                const text = editor.document.getText();
                var userList = [];
                client.users.map( user => { userList.push( "@" + user.username ); } );
                var regex = new RegExp( "(" + userList.join( "|" ) + ")", 'g' );
                let match;
                while( ( match = regex.exec( text ) ) !== null )
                {
                    const tag = match[ match.length - 1 ];
                    const startPos = editor.document.positionAt( match.index );
                    const endPos = editor.document.positionAt( match.index + match[ 0 ].length );
                    const decoration = { range: new vscode.Range( startPos, endPos ) };
                    if( highlights[ tag ] === undefined )
                    {
                        highlights[ tag ] = [];
                    }
                    highlights[ tag ].push( decoration );
                }
                decorations.forEach( decoration =>
                {
                    decoration.dispose();
                } );
                Object.keys( highlights ).forEach( tag =>
                {
                    var decoration = getDecoration( tag );
                    decorations.push( decoration );
                    editor.setDecorations( decoration, highlights[ tag ] );
                } );
            }
        } );
    }

    function register()
    {
        function revealChannel( element, focus, select )
        {
            if( discordChatExplorerView.visible === true )
            {
                discordChatExplorerView.reveal( element, { focus: focus, select: select } );
            }
            if( discordChatView.visible === true )
            {
                discordChatView.reveal( element, { focus: focus, select: select } );
            }
        }

        updateSelectionState();

        var discordChatExplorerView = vscode.window.createTreeView( 'discord-chat-view-explorer', { treeDataProvider: provider } );
        var discordChatView = vscode.window.createTreeView( 'discord-chat-view', { treeDataProvider: provider } );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.refresh', refresh ) );
        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.markAllRead', function()
        {
            provider.markAllRead();
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.createChannel', function()
        {
            if( currentServer )
            {
                vscode.window.showInputBox( { prompt: "Channel name:" } ).then(
                    function( name )
                    {
                        if( name )
                        {
                            currentServer.createChannel( name, 'text' ).then( function( channel )
                            {
                                refresh();
                                var element = provider.getChannelElement( channel );
                                revealChannel( element, true, true );
                            }
                            ).catch(
                                e =>
                                {
                                    vscode.window.showErrorMessage( e.message );
                                }
                            );
                        }
                    } );
            }
            else
            {
                vscode.window.showInformationMessage( "discord-chat: Please select a server first" );
            }
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.deleteChannel', function()
        {
            if( currentChannel )
            {
                vscode.window.showInformationMessage( "discord-chat: Are you sure?", "Yes", "No" ).then( response =>
                {
                    if( response === "Yes" )
                    {
                        currentChannel.delete().then( function()
                        {
                            outputChannels[ currentChannel.id ].outputChannel.dispose();
                            refresh();
                        }
                        ).catch(
                            e =>
                            {
                                console.log( e.message );
                                vscode.window.showErrorMessage( "Failed to delete channel" );
                            }
                        );
                    }
                } );
            }
            else
            {
                vscode.window.showInformationMessage( "discord-chat: Please select a channel first" );
            }
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.post', function()
        {
            if( currentChannel )
            {
                vscode.window.showInputBox( { prompt: "Post message to #" + currentChannel.name } ).then(
                    function( message )
                    {
                        if( message )
                        {
                            currentChannel.send( message );
                        }
                    } );
            }
            else
            {
                vscode.window.showInformationMessage( "discord-chat: Please select a channel first" );
            }
        } ) );

        context.subscriptions.push( vscode.window.onDidChangeWindowState( function( e )
        {
            if( e.focused )
            {
                refresh();
            }
        } ) );

        context.subscriptions.push( vscode.window.onDidChangeActiveTextEditor( function( e )
        {
            var documents = vscode.workspace.textDocuments;

            documents.map( document =>
            {
                console.log( "onDidChangeActiveTextEditor" );
                if( document.uri && document.uri.scheme === 'output' )
                {
                    currentServer = undefined;
                    currentChannel = undefined;

                    Object.keys( outputChannels ).forEach( channelName =>
                    {
                        if( outputChannels[ channelName ].outputChannel._id === document.fileName )
                        {
                            currentChannel = outputChannels[ channelName ].discordChannel;
                            currentServer = currentChannel.guild;

                            updateSelectionState();
                            var element = provider.getChannelElement( outputChannels[ channelName ].discordChannel );
                            revealChannel( element, true, true );

                            triggerHighlight();
                        }
                    } );
                }
            } );
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.openDebugConsole', function()
        {
            generalOutputChannel.show();
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.selectServer', ( server ) =>
        {
            currentServer = server;
            currentChannel = undefined;
            updateSelectionState();
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.openChannel', ( channel ) =>
        {
            currentServer = channel.guild;
            currentChannel = channel;
            updateSelectionState();

            var outputChannel = outputChannels[ channel.id ];
            if( !outputChannel )
            {
                outputChannel = vscode.window.createOutputChannel( utils.toOutputChannelName( channel ) + "." + channel.id );
                outputChannels[ channel.id ] = {
                    outputChannel: outputChannel,
                    discordChannel: channel
                };
                context.subscriptions.push( outputChannel );
            }
            else
            {
                outputChannel = outputChannel.outputChannel;
            }

            outputChannel.show( true );

            populateChannel( channel, triggerHighlight );
        } ) );

        context.subscriptions.push( vscode.workspace.onDidChangeConfiguration( function( e )
        {
            if( e.affectsConfiguration( 'discord-chat.showInExplorer' ) )
            {
                vscode.commands.executeCommand( 'setContext', 'discord-chat-in-explorer', vscode.workspace.getConfiguration( 'discord-chat' ).showInExplorer );
            }
            else if( e.affectsConfiguration( 'discord-chat.token' ) && client.readyAt === null )
            {
                login();
            }
            else if( e.affectsConfiguration( 'discord-chat.compactView' ) ||
                e.affectsConfiguration( 'discord-chat.history' ) )
            {
                Object.keys( outputChannels ).map( outputChannelName =>
                {
                    outputChannels[ outputChannelName ].outputChannel.clear();
                    outputChannels[ outputChannelName ].lastMessage = undefined;
                    populateChannel( outputChannels[ outputChannelName ].discordChannel );
                } );
            }
            else if( e.affectsConfiguration( 'discord-chat.useIcons' ) )
            {
                refresh();
            }
        } ) );

        context.subscriptions.push( generalOutputChannel );

        vscode.commands.executeCommand( 'setContext', 'discord-chat-in-explorer', vscode.workspace.getConfiguration( 'discord-chat' ).showInExplorer );

        client.on( 'error', error =>
        {
            generalOutputChannel.appendLine( "error: " + JSON.stringify( error ) );
        } );
        client.on( 'warn', warning =>
        {
            generalOutputChannel.appendLine( "warning: " + JSON.stringify( warning ) );
        } );
        client.on( 'debug', message =>
        {
            generalOutputChannel.appendLine( "debug: " + JSON.stringify( message ) );
        } );

        client.on( 'ready', () =>
        {
            generalOutputChannel.appendLine( `Logged in as ${client.user.tag}!` );
            refresh();
        } );

        client.on( 'message', message =>
        {
            if( utils.isReadableChannel( message.channel ) )
            {
                var outputChannelName = utils.toOutputChannelName( message.channel );

                generalOutputChannel.appendLine( "Received message on " + outputChannelName );

                if( outputChannelName )
                {
                    if( message.channel === currentChannel )
                    {
                        outputChannels[ message.channel.id ].lastMessage = message;
                        var outputChannel = outputChannels[ message.channel.id ].outputChannel;
                        if( outputChannel )
                        {
                            if( vscode.workspace.getConfiguration( 'discord-chat' ).compactView !== true )
                            {
                                outputChannel.appendLine( "" );
                            }

                            formatMessage( message ).map( entry =>
                            {
                                outputChannel.appendLine( entry );
                            } );

                            triggerHighlight();
                        }
                        provider.markRead( message.channel );
                    }
                    else
                    {
                        provider.update( message );

                        var element = provider.getChannelElement( message.channel );
                        revealChannel( element, false, false );

                        var notify = vscode.workspace.getConfiguration( 'discord-chat' ).notify;
                        if( notify === "always" ||
                            ( notify == "whenHidden" &&
                                ( discordChatExplorerView.visible === false && discordChatView.visible === false ) ) )
                        {
                            vscode.window.showInformationMessage( formatMessage( message ).join() );
                        }
                    }
                }
            }
        } );

        login();
    }

    register();

    return lastRead;
}

function deactivate()
{
}

exports.activate = activate;
exports.deactivate = deactivate;
