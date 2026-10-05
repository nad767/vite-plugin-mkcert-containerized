import myConfig from '@nad767/eslint-config';

const myNormalizedConfig = Array.isArray(myConfig) ? myConfig : [myConfig];

export default [
    ...myNormalizedConfig,
    // Override some rules from my default config.
    {
        rules: {
            'perfectionist/sort-objects':               'off',
            'perfectionist/sort-variable-declarations': 'off',
        },
    },
];
