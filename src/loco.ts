import * as vscode from 'vscode';
import { join } from 'path';

type LocoCofig = {
    url: string,
    apiKey: string,
    lang: string
}

export default class LocoManager {
    private config: LocoCofig;
    private keys: string[] | null = null;
    
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

    async getKeys() {
        if (this.keys === null) {
            await this.refreshKeys();
        }

        return this.keys;
    }

    async refreshKeys() {
        console.debug("Refreshing Loco keys...");

        try {
            const response = await fetch(join(this.config.url, "api/assets"), {
                headers: {
                    Authorization: `Loco ${this.config.apiKey}`
                }
            });
    
            const assets = await response.json() as { id: string }[];
            this.keys = assets.map(({id}) => id);

            console.debug("Keys refreshed");
        } catch (error) {
            console.error('Unexpected error: could not fetch assets from Loco API', error);
            vscode.window.showErrorMessage('Unexpected error: could not fetch assets from Loco API');
        }
    }

    async createKey(key: string) {
        try {
            const response = await fetch(join(this.config.url, 'api/assets'), {
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

            if (!response.ok) {
                const {error: errorMsg} = await response.json() as { status: number, error: string };
                throw new Error(`HTTP ${response.status}: ${errorMsg}`);
            }

            if (this.keys) { this.keys.push(key); }
        } catch (err) {
            console.error('Failed to create key:', err);
            throw err;
        }
    }
}