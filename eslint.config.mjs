import eslint from '@eslint/js'
import tsEslint from 'typescript-eslint'

import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tsEslint.config([
	{
		ignores: ['**/*.js', '**/dist/**', 'node_modules/**'],
	},
	{
		files: ['**/*.ts', '**/*.tsx'],

		extends: [
			eslint.configs.recommended,
			tsEslint.configs.recommended,
			eslintPluginPrettierRecommended,
			eslintConfigPrettier,
		],

		rules: {
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'prettier/prettier': 1
		}
	}
])
