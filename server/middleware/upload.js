import multer from "multer";
import path from "path";
import os from "os";

const storage = multer.diskStorage({
    destination: os.tmpdir(), // Render-safe temp directory
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

export const upload = multer({ storage });
