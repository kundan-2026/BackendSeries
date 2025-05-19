import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middlewares.js";

const router = Router();
router.route("/register").post(
  upload.fields([
    { name: "avtar", maxCount: 1 },
    { name: "coverImage", macCount: 1 },
  ]),
  registerUser
);
// router.route("/login").post(login);

export default router;
