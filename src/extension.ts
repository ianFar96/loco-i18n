// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import EditorManager from './textEditor';
import LocoManager from './loco';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('locoI18n');
	const locoManager = new LocoManager(config);
	const editorManager = new EditorManager(locoManager, config);
	
	const editor = vscode.window.activeTextEditor;
	if (editor) { editorManager.scanDocument(editor); }

	const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor) { editorManager.scanDocument(editor); }
	});

	const editorSaveDisposable = vscode.workspace.onDidSaveTextDocument((document) => {
		const editor = vscode.window.activeTextEditor;
		if (editor && editor.document === document) {
			editorManager.scanDocument(editor);
		}
	});

	const refreshLocalTranslationsDisposable = vscode.commands.registerCommand('loco-i18n.refreshLocalTranslations', async () => {
		await locoManager.refreshTranslations();
		const editor = vscode.window.activeTextEditor;
		if (editor) { editorManager.scanDocument(editor); }
	});

	const createTranslationDisposable = vscode.commands.registerCommand(
		'loco-i18n.createTranslation',
		async (key?: string) => {
			const inputKey = await vscode.window.showInputBox({
				prompt: 'Enter the translation key to create',
				value: key || ''
			});

			if (!inputKey) {
				vscode.window.showWarningMessage('No translation key provided.');
				return;
			}

			const inputTranslation = await vscode.window.showInputBox({
				prompt: 'Enter the translation text to create',
				value: ''
			});

			if (!inputTranslation) {
				vscode.window.showWarningMessage('No translation text provided.');
				return;
			}
			
			try {
				await locoManager.createTranslation(inputKey, inputTranslation);
				vscode.window.showInformationMessage(`Created translation: "${inputKey}"`);
				
				const editor = vscode.window.activeTextEditor;
				if (editor) { editorManager.scanDocument(editor); }
			} catch (err) {
				vscode.window.showErrorMessage(`Failed to create translation: ${err}`);
			}
		}
	);

	context.subscriptions.push(...[
		editorChangeDisposable,
		editorSaveDisposable,
		refreshLocalTranslationsDisposable,
		createTranslationDisposable
	]);
}

// This method is called when your extension is deactivated
export function deactivate() {}
