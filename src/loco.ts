import * as vscode from 'vscode';
import { join } from 'path';

type LocoCofig = {
    url: string,
    apiKey: string,
    lang: string
}

interface Translations {
    [key: string]: Translations | string;
}

export default class LocoManager {
    private config: LocoCofig;
    private translations: Translations | null = null;
    
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

    private async getTranslations() {
        if (this.translations === null) {
            await this.refreshTranslations();
        }

        return this.translations;
    }

    async refreshTranslations() {
        console.debug("Refreshing Loco translations...");

        try {
            const response = await fetch(join(this.config.url, `api/export/locale/${this.config.lang}.json`), {
                headers: {
                    Authorization: `Loco ${this.config.apiKey}`
                }
            });

            this.translations = await response.json() as Translations;

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

            this.setNestedTranslation(key, translation);
        } catch (err) {
            console.error('Failed to create translation:', err);
            throw err;
        }
    }

    private setNestedTranslation(key: string, translation: string) {
        if (this.translations) {
            const splittedKey = key.split('.');
            const nodes = splittedKey.slice(0, -1);
            const leaf = splittedKey.slice(-1)[0];

            let translationsNode = this.translations;
            for (const segment of nodes) {
                if (!(segment in translationsNode)) {
                    translationsNode[segment] = {};
                }
                translationsNode = translationsNode[segment] as Translations;
            }
            translationsNode[leaf] = translation;
        }
    }

    async getNestedTranslation(key: string) {
        const translations = await this.getTranslations();
        
        if (!translations) {return null;}

        const splittedKey = key.split('.');
        const nodes = splittedKey.slice(0, -1);
        const leaf = splittedKey.slice(-1)[0];

        let translationsNode = translations;
        for (const segment of nodes) {
            if (!(segment in translationsNode)) {
                return null;
            }
            translationsNode = translationsNode[segment] as Translations;
        }

        return translationsNode[leaf];
    }

    serializeTranslation(translation: string | Translations): string {
        if (typeof translation === 'object') {
            return JSON.stringify(translation);
        } else {
            return translation;
        }
    }
}