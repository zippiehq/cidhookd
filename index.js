require('events').defaultMaxListeners = 20;

const fs = require('fs');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const Sentry = require('@sentry/node')

const port = process.env.PORT || 3000
const ipfsHost = process.env.BACKEND_IPFS_HOST || 'localhost'
const ipfsPort = process.env.BACKEND_IPFS_PORT || 5001
const secret = process.env.PINNER_SECRET
const sentryDsn = process.env.SENTRY_DSN

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn
  })
  console.log(`Sentry error reporting started: ${sentryDsn}`)
}

if (!secret) {
  console.log(`Secret not present. Refusing to start`);
  process.exit(1);
}

app.use(bodyParser.raw());

const ipfsClient = require('ipfs-http-client');
const goIPFS = ipfsClient(ipfsHost, ipfsPort, { protocol: 'http' });

app.use((req, res, next) => {
  const auth = req.get('Authorization');
  if (auth !== secret) {
    res.statusCode = 401;
    next(new Error(`Invalid Authorization supplied: ${auth}`));
  } else {
    next();
  }
});

app.post('/', async (req, res) => {
  try {
    const data = Buffer.from(req.body);
    const result = await goIPFS.add(data);
    const cid = result[0].path;
    console.log(`Added cid ${cid}`);
    await goIPFS.add(data);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
      cid
    }));
    res.status(200).end();
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.post('/:cid', async (req, res) => {
  try {
    await goIPFS.pin.add(req.params.cid);
    console.log(`Pinning cid ${req.params.cid}`);
    res.status(204).end();
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

//app.delete('/:cid', async (req, res) => {
//  try {
//    await goIPFS.pin.rm(req.params.cid);
//    console.log(`Unpinning cid ${req.params.cid}`);
//  } catch (_) {
//  } finally {
//    res.status(204).end();
//  }
//});

app.get('/health', function(req, res) {
  res.send(JSON.stringify({ status: 'READY' }))
});

console.log('Backend IPFS endpoint is %s:%s', ipfsHost, ipfsPort)

const server = app.listen(port, '0.0.0.0', function() {
  const host = server.address().address
  const port = server.address().port
  console.log('App listening at http://%s:%s', host, port)
})
