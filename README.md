<p align="center"><img src="public/logo.svg" width="96" alt="Crypto logo"></p>

# Crypto

Real-time cryptocurrency trades aggregator: live trades, liquidations, volume and charts streamed directly from 25+ exchanges in your browser.

Crypto is a rebranded fork of [aggr](https://github.com/Tucsky/aggr) by Tucsky. All credit for the original application goes to its authors.

### Changes from upstream aggr

- New name ("Crypto"), logo, favicons and app manifest
- Electric teal (`#00d1b2`) accent color and a deeper navy default background (`#0f131f`)
- Removed third-party analytics (Google Tag Manager) and the donation menu
- Source/issue links point to this repository; GitHub Pages deploys to `/my-aggr/`

## What it does

This tool shows **markets orders** LIVE on the crypto market(s) of your choice.

- Show live trades from exchanges on a specific pair
- Filter noise by aggregating trades with the same timestamp
- Calculate rolling sums over defined periods
- Chart whatever is received from api (so only trades data for now)
- Dynamic audio based on trade volume and size 

Checkout [CHANGELOG.md](CHANGELOG.md) for details about the recent updates.

## How it works

![](https://i.imgur.com/chxtEwb.png)

The application is developed using Vue.js and utilizes the JavaScript WebSocket interface to establish connections with exchange APIs and listen for trade events.

The core functionality involves an aggregator that processes raw trades within a dedicated Worker for each Exchange. The aggregator's main objective is to group trades based on time, market, and trade side. Periodically, the worker sends the aggregated trades to the user interface (UI), accompanied by relevant statistics regarding market activity. These statistics include volume sums, trade counts categorized by sides, and information about liquidations.

## Local Installation and Execution Instructions

To begin, we highly recommend utilizing Volta, a node and npm version manager. We provide a convenient script to automate its installation process. This script is compatible with the bash shell, which is available on all major operating systems including Windows, macOS, and Linux.

```bash
	./scripts/install-volta.sh
```

If you want to use with your own data, edit /.env.local with <code>API_URL=your url</code> and build the app (<code>npm run build</code>).

For development, just as any vuejs project

1. Clone the repo

```bash
git clone https://github.com/kmantos/my-aggr
```

2. Install dependencies

```bash
npm install
```

3. Run it

  

Development mode

```bash
npm run cors
```

This will start a cors proxy for your development environment

```bash
npm run serve
```

Then open the URL Vite prints (usually http://localhost:8080)


```bash
npm run build
```

and access the dist/index.html directly in the browser later without having to run a command

### Docker

Build your own Crypto client with Docker:

```bash
git clone https://github.com/kmantos/my-aggr
cd my-aggr
docker-compose -f "docker\docker-compose.yml" up -d --build # prod
```
 If you want to use aggr-server as your local data source, load the docker-compose.dev.yml instead.

## Configuration

The app uses Vite, which lets you configure it which allows you to configure the client using .env file.

Create a <code>.env.local</code> or <code>.env.development</code> or <code>.env.production</code> (.env.local if you don't know) file inside root folder.

  
|key| description |default value|
|--|--|--|
|<code>API_URL</code>|Server instance url.<br>We use it to fetch historical data for the chart component.<br>Example: http://localhost:3000/ |null|
|<code>PROXY_URL</code>|Redirect HTTP requests from app through a proxy<br>If the <code>PROXY_URL</code> is set to https://cors.aggr.trade/, the app will retrieve Binance's products through this url : https://cors.aggr.trade/https://api.binance.com/api/v3/exchangeInfo |http://localhost:8080/|

## Implement historical data
You can use this project without historical data just by opening the app in your browser, as getting trades from exchanges is made directly in the browser using websocket api.

In order to show historical data YOU WILL need to setup your own server to provide the data using aggr-server.

See [aggr-server repository](https://github.com/Tucsky/aggr-server).

Let's say you have a server instance running on port 3000, start the client with an environment variable `API_URL=http://localhost:3000/ npm run serve`

## Disclaimer

If you plan to use real money with this, USE AT YOUR OWN RISK.

## License

Crypto is licensed under the [GNU General Public License v3.0](LICENSE), the same license as the upstream aggr project. If you distribute this app or a modified version of it, you must make its source code available under the same license.
