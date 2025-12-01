const Class = require("../models/Class");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const mongoose = require("mongoose");

const createClass = async (req, res) => {
  try {
    const { name, code, subject, description, teacherId, startDate, endDate } = req.body;

    if (!teacherId || !name || !subject) {
      return res.status(400).json({
        message: "Teacher, name, and subject are required"
      });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found"
      });
    }

    const newClass = new Class({
      name,
      code,
      subject,
      description,
      teacherId,
      startDate,
      endDate,
    });

    await newClass.save();

    teacher.assignedClasses.push(newClass._id);
    await teacher.save();

    return res.status(201).json({
      message: "Class created successfully",
      class: newClass,
    });
  } catch (error) {
    console.error("Error creating class:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

const deleteClass = async (req, res) => {
  try {
    const { classId } = req.body;

    if (!classId) {
      return res.status(400).json({
        message: "Class ID is required"
      });
    }

    const classToDelete = await Class.findById(classId).populate("teacherId");
    if (!classToDelete) {
      return res.status(404).json({
        message: "Class not found"
      });
    }

    const teacher = classToDelete.teacherId;

    if (teacher) {
      teacher.assignedClasses = teacher.assignedClasses.filter(
        classId => classId.toString() !== classId
      );
      await teacher.save();
    }

    await Student.updateMany(
      { classes: classId },
      { $pull: { classes: classId } }
    );

    await Class.findByIdAndDelete(classId);

    return res.status(200).json({
      message: "Class and all related data deleted successfully.",
      deletedClassId: classId
    });

  } catch (error) {
    console.error("Error deleting class:", error);
    return res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};

const getAllClassesName = async (req, res) => {
  try {
    const classes = await Class.find({}, { _id: 1, name: 1 });

    if (!classes || classes.length === 0) {
      return res.status(404).json({
        message: "No classes found"
      });
    }

    return res.status(200).json({
      message: "Classes fetched successfully",
      classes,
    });
  } catch (error) {
    console.error("Error fetching classes:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

const getAllClasses = async (req, res) => {
  try {
    const { studentId, teacherId, search, page = 1, limit = 10 } = req.body;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    if (studentId) {
      const student = await Student.findOne({
        $or: [
          { _id: studentId },
          { user: studentId }
        ]
      }).populate("classes");

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      const classIds = student.classes.map(c => c._id);

      if (classIds.length === 0) {
        return res.status(200).json({
          message: "Classes fetched successfully",
          classes: [],
          count: 0,
          totalCount: 0,
          currentPage: pageNumber,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false
        });
      }

      let classQuery = { _id: { $in: classIds } };

      if (search) {
        classQuery.$or = [
          { className: { $regex: search, $options: "i" } },
          { subject: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } }
        ];
      }

      const totalCount = await Class.countDocuments(classQuery);
      const totalPages = Math.ceil(totalCount / limitNumber);

      const classes = await Class.find(classQuery)
        .populate("teacherId", "fullName email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber);

      return res.status(200).json({
        message: "Classes fetched successfully",
        classes,
        count: classes.length,
        totalCount,
        currentPage: pageNumber,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1
      });
    }

    else if (teacherId) {
      const teacher = await Teacher.findOne({
        $or: [
          { _id: teacherId },
          { user: teacherId }
        ]
      }).populate({
        path: "assignedClasses",
        match: search
          ? {
              $or: [
                { className: { $regex: search, $options: "i" } },
                { subject: { $regex: search, $options: "i" } }
              ]
            }
          : {}
      });

      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      const classes = teacher.assignedClasses || [];

      const totalCount = classes.length;
      const totalPages = Math.ceil(totalCount / limitNumber);

      const paginatedClasses = classes.slice(skip, skip + limitNumber);

      return res.status(200).json({
        message: "Classes fetched successfully",
        classes: paginatedClasses,
        count: paginatedClasses.length,
        totalCount,
        currentPage: pageNumber,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1
      });
    }

    else {
      let classQuery = {};

      if (search) {
        classQuery.$or = [
          { className: { $regex: search, $options: "i" } },
          { subject: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } }
        ];
      }

      const totalCount = await Class.countDocuments(classQuery);
      const totalPages = Math.ceil(totalCount / limitNumber);

      const allClasses = await Class.find(classQuery)
        .populate("teacherId", "fullName email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber);

      return res.status(200).json({
        message: "All classes fetched successfully",
        classes: allClasses,
        count: allClasses.length,
        totalCount,
        currentPage: pageNumber,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1
      });
    }

  } catch (error) {
    console.error("Error fetching classes:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

const getClassByID = async (req, res) => {
  try {
    const { classId } = req.body;

    if (!classId) {
      return res.status(400).json({
        message: "Class ID is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({
        message: "Invalid Class ID format"
      });
    }

    const classData = await Class.findById(classId)
      .populate('teacherId', 'fullName email phone profilePicture')
      .lean();

    if (!classData) {
      return res.status(404).json({
        message: "Class not found"
      });
    }

    const studentsInClass = await Student.find({
      classes: classId
    })
      .select('studentName email phone dateOfBirth gender enrollDate fee parent')
      .populate('parent', 'parentName email phone relationship')
      .sort({ studentName: 1 });

    const studentCount = await Student.countDocuments({ classes: classId });

    return res.status(200).json({
      message: "Class details fetched successfully",
      class: {
        ...classData,
        studentCount: studentCount
      },
      students: studentsInClass
    });

  } catch (error) {
    console.error("❌ Error fetching class by ID:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

const updateClass = async (req, res) => {
  try {
    const { classId, name, code, subject, description, teacherId, startDate, endDate, isActive } = req.body;

    if (!classId) {
      return res.status(400).json({
        message: "Class ID is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({
        message: "Invalid Class ID format"
      });
    }

    const existingClass = await Class.findById(classId);
    if (!existingClass) {
      return res.status(404).json({
        message: "Class not found"
      });
    }

    if (teacherId && teacherId !== existingClass.teacherId.toString()) {
      const newTeacher = await Teacher.findById(teacherId);
      if (!newTeacher) {
        return res.status(404).json({
          message: "New teacher not found"
        });
      }

      const oldTeacher = await Teacher.findById(existingClass.teacherId);
      if (oldTeacher) {
        oldTeacher.assignedClasses = oldTeacher.assignedClasses.filter(
          classObjId => classObjId.toString() !== classId
        );
        await oldTeacher.save();
      }

      if (!newTeacher.assignedClasses.includes(classId)) {
        newTeacher.assignedClasses.push(classId);
        await newTeacher.save();
      }
    }

    if (code && code !== existingClass.code) {
      const existingClassWithCode = await Class.findOne({ code });
      if (existingClassWithCode && existingClassWithCode._id.toString() !== classId) {
        return res.status(400).json({
          message: "Class code already exists"
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code;
    if (subject !== undefined) updateData.subject = subject;
    if (description !== undefined) updateData.description = description;
    if (teacherId !== undefined) updateData.teacherId = teacherId;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (endDate !== undefined) updateData.endDate = endDate;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedClass = await Class.findByIdAndUpdate(
      classId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('teacherId', 'fullName email phone profilePicture');

    return res.status(200).json({
      message: "Class updated successfully",
      class: updatedClass,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

module.exports = {
  createClass,
  getAllClassesName,
  getAllClasses,
  getClassByID,
  updateClass,
  deleteClass
};