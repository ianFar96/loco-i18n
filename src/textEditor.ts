import * as vscode from 'vscode';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import LocoManager from './loco';

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape special chars
}

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
                                    command: 'loco-i18n.createTranslation',
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

        const inlaysEnabled = vscode.workspace.getConfiguration('editor.inlayHints').get('enabled') === 'on';
        if (inlaysEnabled) {
            vscode.languages.registerInlayHintsProvider(
                this.config.targetLanguages,
                {
                    async provideInlayHints(document, range) {
                        const text = document.getText(range);
                        const hints: vscode.InlayHint[] = [];
    
                        const regex = new RegExp(`${escapeRegex(tFunctionName)}\\s*\\(\\s*['"\`](.+?)['"\`]`, 'g');
                        let match;
    
                        // Offset where the given range starts inside the full document
                        const rangeStartOffset = document.offsetAt(range.start);
    
                        while ((match = regex.exec(text)) !== null) {
                            const key = match[1];
    
                            const endOfMatchInRange = match.index + match[0].length;
                            const absoluteOffset = rangeStartOffset + endOfMatchInRange;
                            const position = document.positionAt(absoluteOffset);
    
                            const translation = await locoManager.getNestedTranslation(key);
                            if (!translation) {continue;}
    
                            const serializedTranslation = locoManager.serializeTranslation(translation);
                            
                            const hint = new vscode.InlayHint(
                                position,
                                ` ${serializedTranslation}`,  // leading space for readability
                                vscode.InlayHintKind.Type
                            );
    
                            hint.tooltip = serializedTranslation;
    
                            hints.push(hint);
                        }
    
                        return hints;
                    }
                }
            );
        } else {
            vscode.languages.registerHoverProvider(
            this.config.targetLanguages,
            {
                async provideHover(document, position) {
                    const range = document.getWordRangeAtPosition(position, /['"`]([^'"`]+)['"`]/);
                    if (!range) {return;}

                    const raw = document.getText(range);
                    const key = raw.slice(1, -1); // remove quotes

                    // Example: Look up the translation value from your cached keys
                    const value = await locoManager.getNestedTranslation(key);

                    if (!value) {return;}

                    return new vscode.Hover(
                        new vscode.MarkdownString(`**${key}**\n\n${locoManager.serializeTranslation(value)}`)
                    );
                }
            });
        }
    }
    
    async scanDocument(editor: vscode.TextEditor) {
        console.debug('Analyzing document...');

        const isTargetLang = this.config.targetLanguages.includes(editor.document.languageId);
        if (!isTargetLang) {return;}
    
        const text = editor.document.getText();
        
        try {
            const keys= this.getKeysFromEditor(text);

            const diagnostics: vscode.Diagnostic[] = [];
            
            for (const node of keys) {
                if (!await this.locoManager.getNestedTranslation(node.value)) {
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

            this.diagnostics.set(editor.document.uri, diagnostics);

            console.debug('Document Analyzed');
        } catch (err) {
            console.error(`Failed to parse file: ${err}`);
        }
    }

    private getKeysFromEditor(text: string) {
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

        return keys;
    }
}
