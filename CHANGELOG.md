# Change Log

All notable changes to the "loco-i18n" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Added support for objects as valid translations.

    Example:
    ```javascript
    // inlay/tooltip -> "{"TEST2": {"TEST3": "TEST4"}}"
    t('TEST1')
    ```

- Fixed missing inlays when function had more than one argument

### 1.2.0

- Changed approach from key-based to translation-based scanning  
- Added inlay hints and hover tooltips for existing translations

### 1.0.0

- Initial release with AST-based key scanning, missing key diagnostics, and Loco integration.

### 1.1.0

- Added Quick Fix option on missing keys  
- Added Create Key command which creates the untranslated asset in Loco
