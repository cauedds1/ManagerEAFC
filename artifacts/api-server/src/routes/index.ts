import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clubsRouter from "./clubs";
import squadRouter from "./squad";
import proxyRouter from "./proxy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clubsRouter);
router.use(squadRouter);
router.use(proxyRouter);

export default router;
