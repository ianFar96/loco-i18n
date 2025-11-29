import * as vscode from 'vscode';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import LocoManager from './loco';

type EditorConfig = {
    tFunctionName: string
    targetLanguages: string[]
}

export default class EditorManager {
    private config: EditorConfig;
    private diagnostics: vscode.DiagnosticCollection;
    
    constructor(
        private locoManager: LocoManager,
        config: vscode.WorkspaceConfiguration
    ) {
        const tFunctionName = config.get<string>('tFunctionName');
        const targetLanguages = config.get<string[]>('targetLanguages');
        if (!tFunctionName || !targetLanguages) {
            vscode.window.showErrorMessage("Cannot initialize Editor manager, missing required settings");
            throw new Error("Cannot initialize Editor manager, missing required settings");
        }

        this.config = {
            tFunctionName,
            targetLanguages
        };

        this.diagnostics = vscode.languages.createDiagnosticCollection('loco-i18n');

        vscode.languages.registerCodeActionsProvider(
            this.config.targetLanguages,
            {
                provideCodeActions: (document, range, context, token) => {
                    const actions: vscode.CodeAction[] = [];

                    for (const diagnostic of context.diagnostics) {
                        if (diagnostic.source === 'loco-i18n' && diagnostic.message.startsWith('Missing translation key')) {
                            const match = diagnostic.message.match(/"(.+?)"/);
                            if (match) {
                                const key = match[1];
                                const action = new vscode.CodeAction(
                                    `Create new translation key: "${key}"`,
                                    vscode.CodeActionKind.QuickFix
                                );

                                action.command = {
                                    title: 'Create translation key',
                                    command: 'loco-i18n.createKey',
                                    arguments: [key]
                                };

                                action.diagnostics = [diagnostic];
                                actions.push(action);
                            }
                        }
                    }

                    return actions;
                }
            },
            { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
        );
    }
    
    async scanDocument(editor: vscode.TextEditor) {
        console.debug('Analyzing document...');

        const isTargetLang = this.config.targetLanguages.includes(editor.document.languageId);
        if (!isTargetLang) {return;}
    
        const text = editor.document.getText();
        
        try {
            const ast = parse(text, {
                sourceType: 'module',
                plugins: [
                    'typescript',
                    'jsx',
                    'decorators-legacy',
                    'classProperties'
                ]
            });
    
            const keys: t.StringLiteral[] = [];
    
            const tFunctionName = this.config.tFunctionName;
            traverse(ast, {
                CallExpression(path) {
                    const node = path.node;
                    if (t.isIdentifier(node.callee, { name: tFunctionName })) {
                        const arg = node.arguments[0];
    
                        if (t.isStringLiteral(arg)) {
                            keys.push(arg);
                        }
                    }
                }
            });

            const locoKeys = await this.locoManager.getKeys();
            const diagnostics: vscode.Diagnostic[] = [];
            
            // When error getting loco keys just empty the diagnostics
            if (locoKeys !== null) {
                for (const node of keys) {
                    if (!locoKeys?.includes(node.value)) {
                        const start = editor.document.positionAt(node.start!);
                        const end = editor.document.positionAt(node.end!);
    
                        const range = new vscode.Range(start, end);
                        const message = `Missing translation key: "${node.value}"`;
    
                        const diagnostic = new vscode.Diagnostic(
                            range,
                            message,
                            vscode.DiagnosticSeverity.Warning
                        );
    
                        diagnostics.push({
                            ...diagnostic,
                            source: 'loco-i18n'
                        });
                    }
                }
            }

            this.diagnostics.set(editor.document.uri, diagnostics);

            console.debug('Document Analyzed');
        } catch (err) {
            console.error(`Failed to parse file: ${err}`);
            vscode.window.showErrorMessage("Failed to parse file");
        }
    }
}
