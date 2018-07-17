/* jshint esversion:6 */

Object.defineProperty( exports, "__esModule", { value: true } );

var path = require( 'path' );
var vscode = require( 'vscode' );

var servers = [];

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

class DiscordChatDataProvider
{
    constructor( _context )
    {
        this._context = _context;

        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getChildren( element )
    {
        if( !element )
        {
            if( servers.length > 0 )
            {
                return servers;
            }
            return [ { name: "Houston - we have a problem..." } ];
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

    getTreeItem( element )
    {
        var treeItem = new vscode.TreeItem( element.name );

        treeItem.id = element.id;

        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;

        if( element.type === SERVER )
        {
            var darkIconPath = this._context.asAbsolutePath( path.join( "resources/icons", "dark", "server.svg" ) );
            var lightIconPath = this._context.asAbsolutePath( path.join( "resources/icons", "light", "server.svg" ) );

            treeItem.iconPath = {
                dark: darkIconPath,
                light: lightIconPath
            };

            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        }
        else if( element.type === CHANNEL )
        {
            var darkIconPath = this._context.asAbsolutePath( path.join( "resources/icons", "dark", "channel.svg" ) );
            var lightIconPath = this._context.asAbsolutePath( path.join( "resources/icons", "light", "channel.svg" ) );

            treeItem.iconPath = {
                dark: darkIconPath,
                light: lightIconPath
            };

            treeItem.command = {
                command: "discord-chat.openChannel",
                title: "",
                arguments: [
                    element.channel
                ]
            };

        }

        if( element.unreadCount && element.unreadCount > 0 )
        {
            treeItem.label = element.name + " (" + element.unreadCount + ")";
        }

        return treeItem;
    }

    clear()
    {
        servers = [];
    }

    populate( channels )
    {
        channels.map( function( channel )
        {
            if( channel.guild && channel.type === "text" )
            {
                var server = servers.find( findServer, channel.guild.id );
                if( server === undefined )
                {
                    server = { type: SERVER, name: channel.guild.name, channels: [], id: channel.guild.id, unreadCount: 0 };
                    servers.push( server );
                }

                var channelItem = server.channels.find( findChannel, channel.id );
                if( channelItem === undefined )
                {
                    channelItem = { type: CHANNEL, name: channel.name, channel: channel, users: [], id: channel.id, unreadCount: 0 };
                    server.channels.push( channelItem );
                }
            }
        } );
    }

    updateServerCount( server )
    {
        var total = 0;
        server.channels.map( channel =>
        {
            total += channel.unreadCount;
        } );
        server.unreadCount = total;
        this._onDidChangeTreeData.fire();
    }

    updateChannelCount( channel, increment )
    {
        var server = servers.find( findServer, channel.guild.id );
        if( server )
        {
            var channelItem = server.channels.find( findChannel, channel.id );
            if( channelItem )
            {
                channelItem.unreadCount = increment ? channelItem.unreadCount + 1 : 0;
                this.updateServerCount( server );
            }
        }
    }

    update( message )
    {
        this.updateChannelCount( message.channel, +1 );
    }

    clearUnread( channel )
    {
        this.updateChannelCount( channel, 0 );
    }

    refresh()
    {
        this._onDidChangeTreeData.fire();
    }
}

exports.DiscordChatDataProvider = DiscordChatDataProvider;
