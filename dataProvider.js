/* jshint esversion:6 */

Object.defineProperty( exports, "__esModule", { value: true } );

var path = require( 'path' );
var vscode = require( 'vscode' );

var lastRead = require( './lastRead' );
var utils = require( './utils' );

var servers = [];

const DEBUG = "debug";
const SERVER = "server";
const CHANNEL = "channel";

function findServer( e )
{
    return e.type === SERVER && e.id.toString() === this.toString();
};

function findChannel( e )
{
    return e.type === CHANNEL && e.id.toString() === this.toString();
};

var status = vscode.window.createStatusBarItem( vscode.StatusBarAlignment.Left, 0 );

class DiscordChatDataProvider
{
    constructor( _context )
    {
        this._context = _context;

        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

        this._icons = {};
    }

    updateStatus()
    {
        var unread = this.unreadCount();
        status.text = "$(comment-discussion) " + unread;
        status.command = "discord-chat.markAllRead";
        status.tooltip = "Click to mark all channels as read";
        if( unread > 0 )
        {
            status.show();
        }
        else
        {
            status.hide();
        }
    }

    getParent( element )
    {
        return element.parent;
    }

    getChildren( element )
    {
        if( !element )
        {
            if( servers.length > 0 )
            {
                return servers;
            }
            return [ { name: "...", type: DEBUG } ];
        }
        else if( element.type === SERVER )
        {
            return element.channels;
        }
        else if( element.type === CHANNEL )
        {
            return element.name;
        }
    }

    getIcon( name )
    {
        var darkIconPath = this._context.asAbsolutePath( path.join( "resources/icons", "dark", name + ".svg" ) );
        var lightIconPath = this._context.asAbsolutePath( path.join( "resources/icons", "light", name + ".svg" ) );

        return {
            dark: darkIconPath,
            light: lightIconPath
        };
    }

    getTreeItem( element )
    {
        var treeItem = new vscode.TreeItem( element.name );

        treeItem.id = element.id;

        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;

        if( element.type === DEBUG )
        {
            treeItem.tooltip = "Open debug console...";
            treeItem.command = {
                command: "discord-chat.openDebugConsole",
                title: "Open debug console"
            };
        }
        else if( element.type === SERVER )
        {
            if( vscode.workspace.getConfiguration( 'discord-chat' ).useIcons === true && element.iconPath )
            {
                treeItem.iconPath = { dark: element.iconPath, light: element.iconPath };
            }
            else if( element.name === utils.directMessagesServerName() )
            {
                treeItem.iconPath = this.getIcon( "dm" );
            }
            else
            {
                treeItem.iconPath = this.getIcon( SERVER );
            }
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            treeItem.tooltip = "";
            treeItem.command = {
                command: "discord-chat.selectServer",
                title: "Select server",
                arguments: [
                    element.server
                ]
            };
        }
        else if( element.type === CHANNEL )
        {
            treeItem.iconPath = this.getIcon( CHANNEL );
            treeItem.tooltip = "Open channel";
            treeItem.command = {
                command: "discord-chat.openChannel",
                title: "Open channel",
                arguments: [
                    element.channel
                ]
            };
        }

        if( element.unreadCount && element.unreadCount > 0 )
        {
            treeItem.label = element.name +
                " (" + element.unreadCount +
                ( element.unreadCount >= vscode.workspace.getConfiguration( 'discord-chat' ).history ? "+" : "" ) +
                ")";
        }

        return treeItem;
    }

    setIcons( icons )
    {
        this._icons = icons;
    }

    populate( channels )
    {
        var me = this;

        servers = [];

        channels.map( function( channel )
        {
            if( utils.isReadableChannel( channel ) )
            {
                var server = servers.find( findServer, utils.toParentId( channel ) );
                if( server === undefined )
                {
                    server = {
                        type: SERVER,
                        name: utils.toServerName( channel ),
                        server: channel.guild,
                        channels: [],
                        id: utils.toParentId( channel ),
                        unreadCount: 0,
                        iconPath: channel.guild ? me._icons[ channel.guild.id ] : undefined
                    };
                    servers.push( server );
                }

                var channelElement = server.channels.find( findChannel, channel.id );
                if( channelElement === undefined )
                {
                    channelElement = { type: CHANNEL, name: utils.toChannelName( channel ), channel: channel, users: [], id: channel.id, unreadCount: 0, parent: server };
                    server.channels.push( channelElement );
                }

                channel.fetchMessages( { limit: vscode.workspace.getConfiguration( 'discord-chat' ).history } ).then( function( messages )
                {
                    me.setUnread( channel, messages );
                } );
            }
        } );
    }

    updateServerCount( server )
    {
        if( server )
        {
            server.unreadCount = server.channels.reduce( ( total, channel ) => total + channel.unreadCount, 0 );
            this._onDidChangeTreeData.fire();
        }
        this.updateStatus();
    }

    getChannelElement( channel )
    {
        var channelElement;
        var server = servers.find( findServer, utils.toParentId( channel ) );
        if( server )
        {
            channelElement = server.channels.find( findChannel, channel.id );
        }
        return channelElement;
    }

    unreadCount()
    {
        return servers.reduce( ( total, server ) => total + server.unreadCount, 0 );
    }

    update( message )
    {
        var channelElement = this.getChannelElement( message.channel );
        if( channelElement )
        {
            ++channelElement.unreadCount;
            this.updateServerCount( servers.find( findServer, utils.toParentId( message.channel ) ) );
        }
    }

    setUnread( channel, messages )
    {
        var channelElement = this.getChannelElement( channel );
        if( channelElement )
        {
            var storedDate = lastRead.getLastRead( channel );
            var channelLastRead = new Date( storedDate ? storedDate : 0 );
            channelElement.unreadCount = messages.reduce( ( total, message ) => total + ( message.createdAt > channelLastRead ? 1 : 0 ), 0 );
            this.updateServerCount( servers.find( findServer, utils.toParentId( channel ) ) );
        }
    }

    markRead( channel, inhibitUpdate )
    {
        var channelElement = this.getChannelElement( channel );
        if( channelElement )
        {
            channelElement.unreadCount = 0;
            lastRead.setLastRead( channel );
            if( inhibitUpdate !== false )
            {
                lastRead.updateLastRead();
            }
            this.updateServerCount( servers.find( findServer, utils.toParentId( channel ) ) );
        }
    }

    markAllRead()
    {
        var me = this;

        servers.map( server =>
        {
            server.channels.map( channelElement =>
            {
                me.markRead( channelElement.channel, false );
            } );
        } );
        lastRead.updateLastRead();
    }

    refresh()
    {
        this._onDidChangeTreeData.fire();
    }
}

exports.DiscordChatDataProvider = DiscordChatDataProvider;
