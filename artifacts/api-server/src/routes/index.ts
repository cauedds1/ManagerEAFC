import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clubsRouter from "./clubs";
import squadRouter from "./squad";
import proxyRouter from "./proxy";
import playersRouter from "./players";
import adminRouter from "./admin";
import noticiasRouter from "./noticias";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clubsRouter);
router.use(squadRouter);
router.use(proxyRouter);
router.use(playersRouter);
router.use(adminRouter);
router.use(noticiasRouter);

export default router;
