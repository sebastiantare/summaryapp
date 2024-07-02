```
npm install

npm install pm2 -g

pm2 startup

sudo env PATH=$PATH:/home/ubuntu/.nvm/versions/node/v18.20.3/bin /home/ubuntu/.nvm/versions/node/v18.20.3/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

pm2 start index.js

pm2 save

pm2 monit
```
