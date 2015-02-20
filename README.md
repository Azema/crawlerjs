# crawlerjs
Crawler that retrieves web pages links SAP

## Dependencies
[Node.js](http://nodejs.org/) is necessary to launch the crawler. It's easy to install, go to the site for details.

## Usage

Firstly, install dependencies
```
cd crawler
npm install
```

```
node ./crawler.js <baseUrl> <sitemap> <fileCSV> [nbProcess]
```

* **baseUrl**: The URL base of website without final slash
* **sitemap**: The path of sitemap file HTTP or FileSystem
* **fileCSV**: The path of CSV file to store links
* **nbProcess**: _Optional_, number of processes to call web pages

Enjoy

[Licence MIT](https://raw.githubusercontent.com/Azema/crawlerjs/master/LICENSE)
