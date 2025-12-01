const Assignment = require("../models/Assignment");
const Class = require("../models/Class");
const Teacher = require("../models/Teacher");
const Grade = require("../models/Grade");
const Student = require("../models/Student");
const mongoose = require("mongoose");
const NotificationService = require("../services/NotificationServices");

const createAssignment = async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      subject,
      classId,
      teacherId,
      totalMarks,
      dueDate,
      attachments,
      student
    } = req.body;

    const classExists = await Class.findById(classId);
    const teacherExists = await Teacher.findById(teacherId);

    if (!classExists || !teacherExists) {
      return res.status(404).json({
        message: "Class or Teacher not found",
      });
    }

    let finalAttachments = [];

    if (Array.isArray(attachments)) {
      finalAttachments = attachments;
    } else if (typeof attachments === "string") {
      try {
        finalAttachments = JSON.parse(attachments);
      } catch (err) {
        return res.status(400).json({ message: "Invalid attachments JSON" });
      }
    } else if (attachments && typeof attachments === "object") {
      finalAttachments = [attachments];
    }

    const newAssessment = await Assignment.create({
      title,
      description,
      type,
      subject,
      class: classId,
      teacher: teacherId,
      student,
      totalMarks,
      dueDate,
      attachments: finalAttachments,
    });

    try {
      if (student) {
        await NotificationService.sendAssignmentNotificationToStudent(newAssessment, student);
        console.log(`Assignment notification sent to student: ${student}`);
      }
    } catch (notificationError) {
      console.error("Failed to send assignment notifications:", notificationError);
    }

    return res.status(201).json({
      message: "Assignment created successfully",
      assessment: newAssessment,
    });

  } catch (error) {
    console.log("Error:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

const deleteAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.body;

    if (!assignmentId) {
      return res.status(400).json({
        message: "Assignment ID is required"
      });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        message: "Assignment not found"
      });
    }

    await Grade.deleteMany({ assignment: assignmentId });

    await Assignment.findByIdAndDelete(assignmentId);

    return res.status(200).json({
      message: "Assignment and all related grades deleted successfully.",
      deletedAssignmentId: assignmentId
    });

  } catch (error) {
    console.error("Error deleting assignment:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

const updateAssignment = async (req, res) => {
  try {
    const {
      assignmentId,
      title,
      description,
      type,
      subject,
      classId,
      teacherId,
      totalMarks,
      dueDate,
      attachments,
      student
    } = req.body;

    if (!assignmentId) {
      return res.status(400).json({
        message: "Assignment ID is required"
      });
    }

    const existingAssignment = await Assignment.findById(assignmentId);
    if (!existingAssignment) {
      return res.status(404).json({
        message: "Assignment not found"
      });
    }

    if (classId) {
      const classExists = await Class.findById(classId);
      if (!classExists) {
        return res.status(404).json({
          message: "Class not found"
        });
      }
    }

    if (teacherId) {
      const teacherExists = await Teacher.findById(teacherId);
      if (!teacherExists) {
        return res.status(404).json({
          message: "Teacher not found"
        });
      }
    }

    let finalAttachments = existingAssignment.attachments || [];

    if (attachments !== undefined) {
      if (Array.isArray(attachments)) {
        finalAttachments = attachments;
      } else if (typeof attachments === "string") {
        try {
          finalAttachments = JSON.parse(attachments);
        } catch (err) {
          return res.status(400).json({ message: "Invalid attachments JSON" });
        }
      } else if (attachments && typeof attachments === "object") {
        finalAttachments = [attachments];
      } else if (attachments === null) {
        finalAttachments = [];
      }
    }

    const updateData = {
      ...(title && { title }),
      ...(description && { description }),
      ...(type && { type }),
      ...(subject && { subject }),
      ...(classId && { class: classId }),
      ...(teacherId && { teacher: teacherId }),
      ...(student && { student }),
      ...(totalMarks && { totalMarks }),
      ...(dueDate && { dueDate }),
      attachments: finalAttachments,
    };

    const updatedAssignment = await Assignment.findByIdAndUpdate(
      assignmentId,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).populate('class')
      .populate('teacher')
      .populate('student');

    return res.status(200).json({
      message: "Assignment updated successfully",
      assessment: updatedAssignment
    });

  } catch (error) {
    console.error("Error updating assignment:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

const getAssignmentById = async (req, res) => {
  try {
    const { assignmentId } = req.body;

    if (!assignmentId) {
      return res.status(400).json({
        message: "Assignment ID or Assessment ID is required"
      });
    }

    const idToFind = assignmentId;

    if (!mongoose.Types.ObjectId.isValid(idToFind)) {
      return res.status(400).json({
        message: "Invalid assignment ID format"
      });
    }

    const assignment = await Assignment.findById(idToFind)
      .populate('class')
      .populate('teacher')
      .populate('student');

    if (!assignment) {
      return res.status(404).json({
        message: "Assignment not found"
      });
    }

    return res.status(200).json({
      message: "Assignment retrieved successfully",
      assessment: assignment
    });

  } catch (error) {
    console.error("Error fetching assignment:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

const uploadSolution = async (req, res) => {
  try {
    const { assignmentId, studentId, file } = req.body;

    if (!file || !file.url) {
      return res.status(400).json({ message: "Solution file URL is required" });
    }

    if (!assignmentId || !studentId) {
      return res.status(400).json({ message: "Assignment ID and Student ID are required" });
    }

    const assignment = await Assignment.findById(assignmentId);
    const student = await Student.findById(studentId);

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (assignment.dueDate && new Date() > assignment.dueDate) {
      return res.status(400).json({ message: "Assignment deadline has passed" });
    }

    const solutionData = {
      student: studentId,
      file: {
        name: file.name || "Solution",
        url: file.url,
        size: file.size || 0,
        type: file.type || "unknown",
        fileName: file.fileName || "solution",
        uploadedAt: new Date(),
      },
      submittedAt: new Date(),
      lastUpdatedAt: new Date(),
      version: 1
    };

    const existingIndex = assignment.solutions.findIndex(
      s => s.student.toString() === studentId
    );

    let message = "";

    if (existingIndex !== -1) {
      const previousSolution = assignment.solutions[existingIndex];
      solutionData.version = (previousSolution.version || 1) + 1;
      solutionData.previousVersions = [...(previousSolution.previousVersions || []), previousSolution.file];

      assignment.solutions[existingIndex] = solutionData;
      message = "Solution updated successfully";
    } else {
      assignment.solutions.push(solutionData);
      message = "Solution uploaded successfully";
    }

    await assignment.save();

    try {
      const teacher = await Teacher.findById(assignment.teacher);
      if (teacher) {
        await NotificationService.sendAssignmentSubmissionNotification(assignment, student, teacher);
        console.log("Assignment submission notification sent to teacher");
      }
    } catch (notificationError) {
      console.error("Failed to send submission notification:", notificationError);
    }

    return res.status(200).json({
      message: message,
      solution: solutionData,
      isUpdate: existingIndex !== -1
    });

  } catch (error) {
    console.error("Upload solution error:", error);
    return res.status(500).json({ message: error.message });
  }
};

const getAssignment = async (req, res) => {
  try {
    const { assessmentId } = req.body;

    if (assessmentId) {
      const assessment = await Assignment.findById(assessmentId)
        .populate("class", "name code")
        .populate("teacher", "fullName email")
        .populate("students", "studentName email");

      if (!assessment)
        return res.status(404).json({
          message: "Assessment not found"
        });

      return res.status(200).json({
        message: "Assessment fetched successfully",
        assessment,
      });
    }

    const assessments = await Assignment.find()
      .populate("class", "name code")
      .populate("teacher", "fullName email")
      .populate("students", "studentName email");

    return res.status(200).json({
      message: "All assessments fetched successfully",
      assessments,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

const getAllAssignment = async (req, res) => {
  try {
    const {
      studentId,
      teacherId,
      page = 1,
      limit = 10,
      search
    } = req.body;

    let query = {};

    if (studentId) {
      const student = await Student.findById(studentId).populate('classes');

      if (!student) {
        return res.status(404).json({
          message: "Student not found"
        });
      }

      if (student.classes && student.classes.length > 0) {
        query = {
          $or: [
            { class: { $in: student.classes.map(cls => cls._id) } },
            { student: student._id }
          ]
        };
      } else {
        query.student = student._id;
      }
    }


    else if (teacherId) {
      query.teacher = teacherId;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;

    const totalAssessments = await Assignment.countDocuments(query);

    const assessments = await Assignment.find(query)
      .populate({
        path: "class",
        select: "name code subject"
      })
      .populate({
        path: "teacher",
        select: "fullName email phone"
      })
      .populate({
        path: "student",
        select: "studentName email"
      })
      .sort({
        dueDate: 1,
        createdAt: -1
      })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      message: "All assessments fetched successfully",
      assessments,
      count: assessments.length,
      totalCount: totalAssessments,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalAssessments / pageSize),
      hasNextPage: pageNumber < Math.ceil(totalAssessments / pageSize),
      hasPrevPage: pageNumber > 1
    });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

const getAssignmentByStudentId = async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        message: "studentId is required"
      });
    }

    const assessments = await Assignment.find({
      students: studentId
    })
      .populate("class", "name code")
      .populate("teacher", "fullName email")
      .populate("students", "studentName email");

    return res.status(200).json({
      message: "Assessments fetched successfully",
      assessments,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

const assignmentCheck = async () => {
  try {
    const today = new Date();

    const assignments = await Assignment.find({ dueDate: { $lt: today } }).populate("student");

    for (let assignment of assignments) {
      let students = [];
      if (assignment.student) {
        students = [assignment.student];
      } else {
        students = await Student.find({ class: assignment.class });
      }

      for (let student of students) {
        const hasSubmitted = assignment.solutions.some(
          sol => sol.student.toString() === student._id.toString()
        );

        if (!hasSubmitted) {
          const gradeExists = await Grade.findOne({
            assignment: assignment._id,
            student: student._id,
          });

          if (!gradeExists) {
            await Grade.create({
              assignment: assignment._id,
              student: student._id,
              marksObtained: 0,
              grade: "F",
              feedback: "Assignment not submitted",
              status: "Graded",
            });

            console.log(`Marked 0 for ${student.studentName} on assignment ${assignment.title}`);
          }
        }
      }
    }

  } catch (err) {
    console.error("Error in assignmentCheck:", err);
  }
};

const getAssignmentAgainstTeacher = async (req, res) => {
  try {
    const { teacherId, page = 1, limit = 10, search = "" } = req.body;

    if (!teacherId) {
      return res.status(400).json({
        success: false,
        message: "Teacher ID is required"
      });
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    
    const finalLimit = Math.min(Math.max(limitNum, 1), 100);
    const finalPage = Math.max(pageNum, 1);
    const skip = (finalPage - 1) * finalLimit;

    const query = { teacher: teacherId };

    if (search && search.trim() !== "") {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { title: regex },
        { description: regex },
        { subject: regex },
        { 'class.name': regex },
        { 'student.studentName': regex }
      ];
    }

    const assignments = await mongoose.model("Assignment")
      .find(query)
      .populate({
        path: "class",
        select: "name"
      })
      .populate({
        path: "teacher",
        select: "name email"
      })
      .populate({
        path: "student",
        select: "studentName email"
      })
      .populate({
        path: "solutions.student",
        select: "studentName email"
      })
      .select("title description subject type totalMarks dateAssigned dueDate attachments solutions class teacher student")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(finalLimit)
      .lean();

    const total = await mongoose.model("Assignment").countDocuments(query);

    const totalPages = Math.ceil(total / finalLimit);

    return res.status(200).json({
      success: true,
      message: "Assignments fetched successfully",
      assignments: assignments,
      pagination: {
        page: finalPage,
        limit: finalLimit,
        total,
        totalPages,
        hasNextPage: finalPage < totalPages,
        hasPrevPage: finalPage > 1
      }
    });

  } catch (error) {
    console.error("Error fetching teacher assignments:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = {
  createAssignment,
  getAssignment,
  getAllAssignment,
  getAssignmentByStudentId,
  uploadSolution,
  assignmentCheck,
  getAssignmentAgainstTeacher,
  deleteAssignment,
  updateAssignment,
  getAssignmentById
};
