/* jshint esversion:6 */

const discord = require( 'discord.js' );
const strftime = require( 'strftime' );
const vscode = require( 'vscode' );
var treeView = require( "./dataProvider" );

var outputChannels = {};
var currentChannel;

function activate( context )
{
    const client = new discord.Client();

    var provider = new treeView.DiscordChatDataProvider( context );
    // var status = vscode.window.createStatusBarItem( vscode.StatusBarAlignment.Left, 0 );
    var generalOutputChannel = vscode.window.createOutputChannel( 'discord-chat' );

    function formatMessage( message )
    {
        var entries = [];

        var timestamp = strftime( "%a %H:%M:%S", new Date( message.createdAt ) );

        if( message.type == "GUILD_MEMBER_JOIN" )
        {
            entries.push( timestamp + " " + message.author.username + " joined" );
        }
        else if( message.cleanContent )
        {
            entries.push( timestamp + " " + message.author.username + ":\n " + message.cleanContent );
        }
        else if( message.content )
        {
            entries.push( timestamp + " " + message.author.username + ":\n " + message.content );
        }

        message.attachments.map( function( attachment )
        {
            entries.push( timestamp + " " + message.author.username + " attached " + attachment.url );
        } );

        return entries;
    }

    function register()
    {
        vscode.window.registerTreeDataProvider( 'discord-chat', provider );
        vscode.window.registerTreeDataProvider( 'discord-chat-explorer', provider );

        context.subscriptions.push(
            vscode.commands.registerCommand( 'discord-chat.openChannel', ( channel ) =>
            {
                var outputChannelName = 'discord-chat.' + channel.guild.name + '.' + channel.name;
                currentChannel = channel;

                var outputChannel = vscode.window.createOutputChannel( outputChannelName );
                outputChannels[ outputChannelName ] = outputChannel;
                context.subscriptions.push( outputChannel );

                var entries = [];
                channel.fetchMessages( { limit: vscode.workspace.getConfiguration( 'discord-chat' ).history } ).then( function( messages )
                {
                    messages.map( function( message )
                    {
                        entries = entries.concat( formatMessage( message ) );
                    } );

                    entries.reverse().map( function( entry )
                    {
                        outputChannel.appendLine( entry );
                    } );

                    outputChannel.show( false );

                    provider.clearUnread( channel );
                } );

            } ) );

        context.subscriptions.push(
            vscode.commands.registerCommand( 'discord-chat.post', function()
            {
                vscode.window.showInputBox( { prompt: "Post message to " + currentChannel.name } ).then(
                    function( message )
                    {
                        currentChannel.send( message );
                    } );
            } ) );

        context.subscriptions.push( vscode.workspace.onDidChangeConfiguration( function( e )
        {
            if( e.affectsConfiguration( "discord-chat" ) )
            {
                vscode.commands.executeCommand( 'setContext', 'discord-chat-in-explorer', vscode.workspace.getConfiguration( 'discord-chat' ).showInExplorer );
            }
        } ) );

        context.subscriptions.push( generalOutputChannel );

        vscode.commands.executeCommand( 'setContext', 'discord-chat-in-explorer', vscode.workspace.getConfiguration( 'discord-chat' ).showInExplorer );

        client.on( 'ready', () =>
        {
            generalOutputChannel.appendLine( `Logged in as ${client.user.tag}!` );
            provider.populate( client.channels );
            provider.refresh();
        } );

        client.on( 'message', message =>
        {
            if( message.channel.type === "text" )
            {
                if( message.channel === currentChannel )
                {
                    var outputChannelName = 'discord-chat.' + message.channel.guild.name + '.' + message.channel.name;
                    var outputChannel = outputChannels[ outputChannelName ];
                    if( outputChannel )
                    {
                        formatMessage( message ).map( entry =>
                        {
                            outputChannel.appendLine( entry )
                        } );
                    }
                    provider.clearUnread( message.channel );
                }
                else
                {
                    provider.update( message );
                }
            }
        } );

        var token = vscode.workspace.getConfiguration( 'discord-chat' ).token;
        if( token )
        {
            client.login( token );
        }
        else
        {
            vscode.window.showInformationMessage( "Please set discord-chat.token" );
        }
    }

    register();
}

function deactivate()
{
}

exports.activate = activate;
exports.deactivate = deactivate;
