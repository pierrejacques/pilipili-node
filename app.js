const Koa = require('koa');
const process = require('process');
const bodyParser = require('koa-bodyparser');
const lark = require('@larksuiteoapi/node-sdk');

const [, , appId, appSecret, portOverwrite] = process.argv;

if (!appId || !appSecret) throw new Error('appId & appSecret must be provided');

const client = new lark.Client({
  appId,
  appSecret,
  // disableTokenCache: true,
});

async function getTenantAccessToken() {
  const { tenant_access_token } = await client.auth.v3.tenantAccessToken.internal({
    data: {
      app_id: appId,
      app_secret: appSecret
    },
  },
    lark.withTenantToken("")
  )

  return tenant_access_token;
}


const chatPromise = (async () => {
  const token = await getTenantAccessToken();

  const { data } = await client.im.v1.chat.list({
    params: {
      sort_type: 'ByCreateTimeAsc',
      page_size: 1,
    },
  },
    lark.withTenantToken(token)
  )

  const chatId = data.items[0]?.chat_id;

  console.log('chat_id fetched:', chatId);
  return chatId;
})();

const app = new Koa();

app.use(bodyParser());

app.use(async ctx => {
  const chatId = await chatPromise;

  if (chatId) {
    const token = await getTenantAccessToken();

    const res = await client.im.v1.message.create({
      params: {
        receive_id_type: 'chat_id',
      },
      data: {
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({
          text: JSON.stringify(ctx.request.body)
        })
      },
    },
      lark.withTenantToken(token)
    );

    ctx.body = res;
  }

  ctx.body = null;
});

const PORT = portOverwrite || 3002;

app.listen(PORT);

console.log(`app listening port: ${PORT}`);
