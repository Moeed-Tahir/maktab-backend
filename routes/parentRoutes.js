const express = require("express");
const router = express.Router();
const {
    addCardDetail,
    addToWaitList,
    createParent,
    getAllParents,
    getAllParentsWithStudents,
    getAllWaitlistParents,
    getParentById,
    processCardPayment,
    removeCardDetail,
    removeFromWaitList,
    setCardDefault,
    getParentDashboardStats,
    deleteParent
} = require("../controllers/ParentController");

router.post("/createParent", createParent);

router.post("/addToWaitList", addToWaitList);
router.post("/removeFromWaitList", removeFromWaitList);

// Parent retrieval
router.post("/getAllParents", getAllParents);
router.post("/getAllParentsWithStudents", getAllParentsWithStudents);
router.post("/getAllWaitlistParents", getAllWaitlistParents);
router.post("/getParentById", getParentById);

router.post("/addCardDetail", addCardDetail);
router.post("/removeCardDetail", removeCardDetail);
router.post("/setCardDefault", setCardDefault);

router.post("/processCardPayment", processCardPayment);
router.post("/deleteParent", deleteParent);
router.post("/getParentDashboardStats", getParentDashboardStats);

module.exports = router;
