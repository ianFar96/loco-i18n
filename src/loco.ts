import * as vscode from 'vscode';
import { join } from 'path';

type LocoCofig = {
    url: string,
    apiKey: string,
    lang: string
}

export default class LocoManager {
    private config: LocoCofig;
    private translations: Record<string, string> | null = null;
    
    constructor(config: vscode.WorkspaceConfiguration) {
        const url = config.get<string>('remoteUrl');
        const apiKey = config.get<string>('apiKey');
        const lang = config.get<string>('lang');
        
        if (!url || !apiKey || !lang) {
            vscode.window.showErrorMessage("Cannot initialize Loco manager, missing required settings");
            throw new Error("Cannot initialize Loco manager, missing required settings");
        }

        this.config = {
            url,
            apiKey,
            lang
        };
    }

    async getTranslations() {
        if (this.translations === null) {
            await this.refreshTranslations();
        }

        return this.translations;
    }

    async refreshTranslations() {
        console.debug("Refreshing Loco translations...");

        try {
            const response = await fetch(join(this.config.url, `api/export/locale/${this.config.lang}.json?no-expand`), {
                headers: {
                    Authorization: `Loco ${this.config.apiKey}`
                }
            });

            this.translations = await response.json() as Record<string, string>;

            console.debug("Translations refreshed");
        } catch (error) {
            console.error('Unexpected error: could not fetch translations from Loco API', error);
            vscode.window.showErrorMessage('Unexpected error: could not fetch translations from Loco API');
        }
    }

    async createTranslation(key: string, translation: string) {
        try {
            const assetResponse = await fetch(join(this.config.url, 'api/assets'), {
                method: 'POST',
                headers: {
                    Authorization: `Loco ${this.config.apiKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    id: key,
                    default: 'untranslated',
                })
            });

            if (!assetResponse.ok) {
                const {error: errorMsg} = await assetResponse.json() as { status: number, error: string };
                throw new Error(`HTTP ${assetResponse.status}: ${errorMsg}`);
            }

            const translateResponse = await fetch(join(this.config.url, `api/translations/${key}/${this.config.lang}`), {
                method: 'POST',
                headers: {
                    Authorization: `Loco ${this.config.apiKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: translation
            });

            if (!translateResponse.ok) {
                const {error: errorMsg} = await translateResponse.json() as { status: number, error: string };
                throw new Error(`HTTP ${translateResponse.status}: ${errorMsg}`);
            }

            if (this.translations) {
                this.translations[key] = translation;
            }
        } catch (err) {
            console.error('Failed to create translation:', err);
            throw err;
        }
    }
}