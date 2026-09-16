import express from 'express';
import rootRouter from './routes/root.router.js';
import { config } from 'dotenv';

config ();

const app = express();

app.use('/', rootRouter);



app.listen(process.env.PORT, () => {
  console.log(" Server is corriendo on puerto " + process.env.PORT);
}   
);