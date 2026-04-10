import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clubsRouter from "./clubs";
import squadRouter from "./squad";
import proxyRouter from "./proxy";
import playersRouter from "./players";
import adminRouter from "./admin";
import noticiasRouter from "./noticias";
import storageRouter from "./storage";
import diretoriaRouter from "./diretoria";
import careersRouter from "./careers";
import gamedataRouter from "./gamedata";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clubsRouter);
router.use(squadRouter);
router.use(proxyRouter);
router.use(playersRouter);
router.use(adminRouter);
router.use(noticiasRouter);
router.use(storageRouter);
router.use(diretoriaRouter);
router.use(careersRouter);
router.use(gamedataRouter);

export default router;
