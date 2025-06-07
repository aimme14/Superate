### --------------------------------------Description-------------------------------------- ###
## E-commerce
### Vite + TypeScript

### --------------------------------------Typescript documentation-------------------------------------- ###
````ts
// client/tsconfig.app.json
"include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/**/*.d.ts"
  ] 

// cors.json to allow methods get (googleCloud)
[
  {
    "method": ["GET"],
    "maxAgeSeconds": 3600,
    "origin": ["*"]
  }
]
```

//default config for github actions (qiita-cli)
```yaml
name: Publish articles

on:
  push:
    branches:
      - main
      - master
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false

jobs:
  publish_articles:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: increments/qiita-cli/actions/publish@v1
        with:
          qiita-token: ${{ secrets.QIITA_TOKEN }}
          root: "."
```

//deploy config for github actions (qiita-cli)
```yaml
jobs:
  deploy:
    environment: Production
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: increments/qiita-cli/actions/publish@v1
        with:
          qiita-token: ${{ secrets.QIITA_TOKEN }}
          root: "."
```