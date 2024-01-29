// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext)
{
	const provider = new OpenedFilesProvider();
	vscode.window.registerTreeDataProvider('openedFilesView', provider);
}

// This method is called when your extension is deactivated
export function deactivate() { }

class FileTreeItem extends vscode.TreeItem
{
	constructor(public readonly fileUri: vscode.Uri)
	{
		super(path.basename(fileUri.fsPath), vscode.TreeItemCollapsibleState.None);
		this.tooltip = this.fileUri.fsPath;
		this.command = { command: 'vscode.open', title: "Open File", arguments: [this.fileUri], };
		this.iconPath = vscode.ThemeIcon.File;
		this.resourceUri = this.fileUri;
	}
}

class FolderTreeItem extends vscode.TreeItem
{
	constructor(public readonly folderUri: vscode.Uri)
	{
		super(path.basename(folderUri.fsPath), vscode.TreeItemCollapsibleState.Expanded);
		this.tooltip = this.folderUri.fsPath;
		this.iconPath = vscode.ThemeIcon.Folder;
		this.resourceUri = this.folderUri;
	}

}


export class OpenedFilesProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

	private openedFiles: vscode.TextDocument[] = [];

	constructor()
	{
		vscode.workspace.onDidOpenTextDocument(this._onDocumentOpened, this);
		vscode.workspace.onDidCloseTextDocument(this._onDocumentClosed, this);
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem
	{
		return element;
	}

	getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]>
	{
		if (element instanceof FolderTreeItem)
		{
			return Promise.resolve(this.getFilesInFolder(element.folderUri));
		} else if (element === undefined)
		{
			return Promise.resolve(this.getRootFolders());
		}
		return Promise.resolve([]);
	}

	private _onDocumentOpened(doc: vscode.TextDocument): void
	{
		this.openedFiles.push(doc);
		this._onDidChangeTreeData.fire();
	}

	private _onDocumentClosed(doc: vscode.TextDocument): void
	{
		this.openedFiles = this.openedFiles.filter(d => d.uri.toString() !== doc.uri.toString());
		this._onDidChangeTreeData.fire();
	}

	private getRootFolders(): vscode.TreeItem[]
	{
		let folders = new Set<string>();
		this.openedFiles.forEach(doc =>
		{
			let dir = path.dirname(doc.uri.fsPath);
			folders.add(dir);
		});
		return Array.from(folders).map(folderPath => new FolderTreeItem(vscode.Uri.file(folderPath)));
	}

	private getFilesInFolder(folderUri: vscode.Uri): vscode.TreeItem[]
	{
		return this.openedFiles
			.filter(doc => path.dirname(doc.uri.fsPath) === folderUri.fsPath)
			.filter(doc => doc.fileName.endsWith(".git") === false)
			.map(doc => new FileTreeItem(doc.uri));
	}
}