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
}