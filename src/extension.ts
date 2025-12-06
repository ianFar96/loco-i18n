// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import EditorManager from './textEditor';
import LocoManager from './loco';

// TODO: ask the user if they want to enable the extension in this project and store the preference
// this avoids bothering them if they open a non-internationalized project

// TODO: add autocomplete for translation keys when typing inside tFunctionName calls

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('locoI18n');
	const locoManager = new LocoManager(config);
	const editorManager = new EditorManager(locoManager, config);

	// Refresh translations on activation
	await locoManager.refreshTranslations();
	
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
