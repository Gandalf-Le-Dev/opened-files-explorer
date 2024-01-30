// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext)
{
	const provider = new OpenedFilesProvider();

	// Load currently opened files
	vscode.window.visibleTextEditors.forEach(editor =>
	{
		if (editor.document && editor.document.uri)
		{
			provider.addDocument(editor.document);
		}
	});

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
	public children: vscode.TreeItem[] = [];

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

	// getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]>
	// {
	// 	if (element instanceof FolderTreeItem)
	// 	{
	// 		return Promise.resolve(this.getFilesInFolder(element.folderUri));
	// 	} else if (element === undefined)
	// 	{
	// 		return Promise.resolve(this.getRootFolders());
	// 	}
	// 	return Promise.resolve([]);
	// }

	getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]>
	{
		if (element instanceof FolderTreeItem)
		{
			return Promise.resolve(element.children);
		} else if (element === undefined)
		{
			return Promise.resolve(this.buildFolderTree());
		}
		return Promise.resolve([]);
	}


	public addDocument(doc: vscode.TextDocument): void
	{
		if (!this.openedFiles.includes(doc))
		{
			this.openedFiles.push(doc);
			this._onDidChangeTreeData.fire();
		}
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

	private getWorkspaceRoot(): string | undefined
	{
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
		{
			return vscode.workspace.workspaceFolders[0].uri.fsPath;
		}
		return undefined;
	}

	private getRootFolders(): vscode.TreeItem[]
	{
		let folders = new Set<string>();
		this.openedFiles.forEach(doc =>
		{
			let dir = path.dirname(doc.uri.fsPath);
			while (dir && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.some(wsFolder => dir.startsWith(wsFolder.uri.fsPath)))
			{
				folders.add(dir);
				dir = path.dirname(dir); // Move up one directory
			}
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


	private buildFolderTree(): vscode.TreeItem[]
	{
		const workspaceRoot = this.getWorkspaceRoot();
		if (!workspaceRoot)
		{
			return []; // No workspace open
		}

		const rootItem = new FolderTreeItem(vscode.Uri.file(workspaceRoot));
		const allItems: { [key: string]: FolderTreeItem } = { [workspaceRoot]: rootItem };

		this.openedFiles.filter(doc => doc.fileName.endsWith(".git") === false).forEach(doc =>
		{
			let currentPath = doc.uri.fsPath;
			let parentPath = path.dirname(currentPath);

			while (parentPath && parentPath.startsWith(workspaceRoot))
			{
				if (!allItems[parentPath])
				{
					allItems[parentPath] = new FolderTreeItem(vscode.Uri.file(parentPath));
					let parentParentPath = path.dirname(parentPath);
					if (allItems[parentParentPath])
					{
						allItems[parentParentPath].children.push(allItems[parentPath]);
					}
				}

				if (allItems[parentPath].children.indexOf(allItems[currentPath]) === -1)
				{
					allItems[parentPath].children.push(new FileTreeItem(vscode.Uri.file(currentPath)));
					break;
				}

				currentPath = parentPath;
				parentPath = path.dirname(parentPath);
			}
		});

		return [rootItem];
	}

}