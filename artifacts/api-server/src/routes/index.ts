import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clubsRouter from "./clubs";
import squadRouter from "./squad";
import proxyRouter from "./proxy";
import playersRouter from "./players";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clubsRouter);
router.use(squadRouter);
router.use(proxyRouter);
router.use(playersRouter);

export default router;
