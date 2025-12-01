const Grade = require("../models/Grade");
const Student = require("../models/Student");
const Assignment = require("../models/Assignment");
const Teacher = require("../models/Teacher");
const mongoose = require("mongoose");
const NotificationService = require("../services/NotificationServices");

const createGrade = async (req, res) => {
  try {
    const { assignmentId, studentId, marksObtained, gradedBy, feedback } = req.body;

    if (!assignmentId || !studentId || marksObtained === undefined || !gradedBy) {
      return res.status(400).json({
        message: "Missing required fields: assignmentId, studentId, marksObtained, gradedBy"
      });
    }

    if (!mongoose.isValidObjectId(assignmentId)) {
      return res.status(400).json({
        message: `Invalid assessment ID format: ${assignmentId}`
      });
    }

    if (!mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({
        message: `Invalid student ID format: ${studentId}`
      });
    }

    const assignment = await Assignment.findById(assignmentId);
    const student = await Student.findById(studentId);

    if (!assignment) {
      return res.status(404).json({
        message: `Assignment not found with ID: ${assignmentId}`
      });
    }

    if (!student) {
      return res.status(404).json({
        message: `Student not found with ID: ${studentId}`
      });
    }

    const marksNum = parseFloat(marksObtained);
    const totalMarksNum = parseFloat(assignment.totalMarks);

    if (isNaN(marksNum) || isNaN(totalMarksNum)) {
      return res.status(400).json({
        message: "Marks must be valid numbers"
      });
    }

    if (marksNum < 0) {
      return res.status(400).json({
        message: "Marks obtained cannot be negative"
      });
    }

    if (marksNum > totalMarksNum) {
      return res.status(400).json({
        message: `Marks obtained (${marksNum}) cannot exceed total marks (${totalMarksNum})`,
        totalMarks: totalMarksNum,
        maxAllowed: totalMarksNum
      });
    }

    const percentage = (marksNum / totalMarksNum) * 100;

    let gradeLetter;
    if (percentage >= 90) gradeLetter = "A+";
    else if (percentage >= 80) gradeLetter = "A";
    else if (percentage >= 70) gradeLetter = "B+";
    else if (percentage >= 60) gradeLetter = "B";
    else if (percentage >= 50) gradeLetter = "C";
    else if (percentage >= 40) gradeLetter = "D";
    else gradeLetter = "F";

    const existingGrade = await Grade.findOne({
      assignment: assignmentId,
      student: studentId
    });

    if (existingGrade) {
      return res.status(409).json({
        message: "Grade already exists for this student and assignment",
        existingGrade: {
          _id: existingGrade._id,
          marksObtained: existingGrade.marksObtained,
          grade: existingGrade.grade
        }
      });
    }

    const newGrade = await Grade.create({
      assignment: assignmentId,
      student: studentId,
      marksObtained: marksNum,
      totalMarks: totalMarksNum,
      percentage: percentage.toFixed(2),
      gradedBy: gradedBy,
      feedback: feedback || "",
      grade: gradeLetter,
      status: "Graded",
      gradedAt: new Date()
    });

    console.log("New grade created successfully:", newGrade._id);

    try {
      await NotificationService.sendGradeNotification(newGrade, student, assignment);
      console.log("Grade notification sent to student");
    } catch (notificationError) {
      console.error("Failed to send grade notification:", notificationError);
    }

    try {
      const updatedAssignment = await Assignment.findOneAndUpdate(
        {
          _id: assignmentId,
          "solutions.student": studentId
        },
        {
          $set: {
            "solutions.$.marksObtained": marksNum,
            "solutions.$.gradedBy": gradedBy,
            "solutions.$.feedback": feedback || "",
            "solutions.$.gradedAt": new Date()
          }
        },
        { new: true }
      );

      if (updatedAssignment) {
        console.log("Assignment solutions updated with grade");
      } else {
        console.log("No matching solution found in assignment to update");
      }
    } catch (updateError) {
      console.log("Note: Could not update assignment solutions:", updateError.message);
    }

    return res.status(201).json({
      message: "Grade created successfully",
      grade: {
        _id: newGrade._id,
        assignment: newGrade.assignment,
        student: newGrade.student,
        marksObtained: newGrade.marksObtained,
        totalMarks: newGrade.totalMarks,
        percentage: newGrade.percentage,
        grade: newGrade.grade,
        gradedBy: newGrade.gradedBy,
        feedback: newGrade.feedback,
        status: newGrade.status,
        gradedAt: newGrade.gradedAt
      },
    });

  } catch (error) {
    console.error("=== ERROR IN CREATE GRADE ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);

    if (error.name === 'CastError') {
      return res.status(400).json({
        message: "Invalid data format provided",
        error: error.message
      });
    }

    if (error.name === 'ValidationError') {
      const errors = {};
      for (let field in error.errors) {
        errors[field] = error.errors[field].message;
      }
      return res.status(400).json({
        message: "Validation failed",
        errors: errors
      });
    }

    return res.status(500).json({
      message: "Internal server error while creating grade",
      error: process.env.NODE_ENV === 'development' ? error.message : "Something went wrong"
    });
  }
};

const getGrades = async (req, res) => {
  try {
    const { studentId, teacherId, search, page = 1, limit = 10 } = req.body;
    
    let query = {};
    
    if (studentId) {
      const student = await Student.findById(studentId);

      if (!student) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      query.student = student._id;
    } 
    
    else if (teacherId) {
      const teacherAssignments = await Assignment.find({ teacher: teacherId }).select("_id");
      const assignmentIds = teacherAssignments.map(a => a._id);

      query.assignment = { $in: assignmentIds };
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");

      const searchConditions = {
        $or: [
          { "student.studentName": searchRegex },
          { "assignment.title": searchRegex },
          { "assignment.subject": searchRegex }
        ]
      };

      query = Object.keys(query).length > 0
        ? { $and: [query, searchConditions] }
        : searchConditions;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await Grade.countDocuments(query);

    const grades = await Grade.find(query)
      .populate({
        path: "assignment",
        select: "title subject totalMarks class teacher",
        populate: [
          { path: "class", select: "name code" },
          { path: "teacher", select: "fullName" }
        ]
      })
      .populate({
        path: "student",
        select: "studentName email"
      })
      .populate({
        path: "gradedBy",
        select: "fullName"
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      message: "Grades fetched successfully",
      grades,
      count: grades.length,
      totalCount,
      pagination: {
        currentPage: pageNum,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        limit: limitNum
      }
    });

  } catch (error) {
    console.error("Error fetching grades:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


const getGradesByStudentId = async (req, res) => {
  try {
    const { studentId } = req.body;

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    const grades = await Grade.find({ student: studentId })
      .populate("assignment", "title subject totalMarks")
      .populate("gradedBy", "fullName");

    return res.status(200).json({
      message: "Grades for student fetched successfully",
      grades,
    });

  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

const getGradeById = async (req, res) => {
  try {
    const { gradeId } = req.body;

    if (!gradeId) {
      return res.status(400).json({
        message: "Grade ID is required"
      });
    }

    if (!mongoose.isValidObjectId(gradeId)) {
      return res.status(400).json({
        message: `Invalid grade ID format: ${gradeId}`
      });
    }

    const grade = await Grade.findById(gradeId)
      .populate({
        path: "assignment",
        select: "title subject totalMarks class teacher dueDate",
        populate: [
          {
            path: "class",
            select: "name code"
          },
          {
            path: "teacher",
            select: "fullName email"
          }
        ]
      })
      .populate({
        path: "student",
        select: "studentName email rollNumber"
      })
      .populate({
        path: "gradedBy",
        select: "fullName email"
      });

    if (!grade) {
      return res.status(404).json({
        message: `Grade not found with ID: ${gradeId}`
      });
    }

    return res.status(200).json({
      message: "Grade fetched successfully",
      grade
    });

  } catch (error) {
    console.error("Error fetching grade by ID:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        message: "Invalid grade ID format"
      });
    }

    return res.status(500).json({
      message: "Internal server error while fetching grade",
      error: process.env.NODE_ENV === 'development' ? error.message : "Something went wrong"
    });
  }
};

const updateGradeById = async (req, res) => {
  try {
    const { marksObtained, feedback, gradedBy, gradeId } = req.body;
    
    if (!gradeId) {
      return res.status(400).json({
        message: "Grade ID is required"
      });
    }

    if (!mongoose.isValidObjectId(gradeId)) {
      return res.status(400).json({
        message: `Invalid grade ID format: ${gradeId}`
      });
    }

    const grade = await Grade.findById(gradeId)
      .populate("assignment", "title subject totalMarks")
      .populate("student", "studentName email");

    if (!grade) {
      return res.status(404).json({
        message: `Grade not found with ID: ${gradeId}`
      });
    }

    if (!grade.assignment) {
      return res.status(404).json({
        message: "Associated assignment not found"
      });
    }

    const totalMarksNum = grade.assignment.totalMarks;
    
    if (!totalMarksNum || totalMarksNum <= 0) {
      return res.status(400).json({
        message: "Assignment total marks is invalid or not set"
      });
    }

    const updateData = {};
    let marksNum = grade.marksObtained;

    if (marksObtained !== undefined) {
      marksNum = parseFloat(marksObtained);

      if (isNaN(marksNum)) {
        return res.status(400).json({
          message: "Marks obtained must be a valid number"
        });
      }

      if (marksNum < 0) {
        return res.status(400).json({
          message: "Marks obtained cannot be negative"
        });
      }

      if (marksNum > totalMarksNum) {
        return res.status(400).json({
          message: `Marks obtained (${marksNum}) cannot exceed total marks (${totalMarksNum})`,
          totalMarks: totalMarksNum,
          maxAllowed: totalMarksNum
        });
      }

      const percentage = (marksNum / totalMarksNum) * 100;

      let gradeLetter;
      if (percentage >= 90) gradeLetter = "A+";
      else if (percentage >= 80) gradeLetter = "A";
      else if (percentage >= 70) gradeLetter = "B+";
      else if (percentage >= 60) gradeLetter = "B";
      else if (percentage >= 50) gradeLetter = "C";
      else if (percentage >= 40) gradeLetter = "D";
      else gradeLetter = "F";

      updateData.marksObtained = marksNum;
      updateData.percentage = percentage.toFixed(2);
      updateData.grade = gradeLetter;
      updateData.status = "Graded";
    }

    if (feedback !== undefined) {
      updateData.feedback = feedback;
    }

    if (gradedBy !== undefined) {
      if (!mongoose.isValidObjectId(gradedBy)) {
        return res.status(400).json({
          message: `Invalid gradedBy ID format: ${gradedBy}`
        });
      }
      updateData.gradedBy = gradedBy;
    }

    if (Object.keys(updateData).length > 0) {
      updateData.gradedAt = new Date();
    } else {
      return res.status(400).json({
        message: "No valid fields provided for update"
      });
    }

    const updatedGrade = await Grade.findByIdAndUpdate(
      gradeId,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate({
        path: "assignment",
        select: "title subject totalMarks",
        populate: {
          path: "teacher",
          select: "fullName"
        }
      })
      .populate({
        path: "student",
        select: "studentName email"
      })
      .populate({
        path: "gradedBy",
        select: "fullName"
      });

    if (marksObtained !== undefined) {
      try {
        const updatedAssignment = await Assignment.findOneAndUpdate(
          {
            _id: grade.assignment._id,
            "solutions.student": grade.student._id
          },
          {
            $set: {
              "solutions.$.marksObtained": marksNum,
              "solutions.$.gradedBy": updateData.gradedBy || grade.gradedBy,
              "solutions.$.feedback": updateData.feedback || grade.feedback,
              "solutions.$.gradedAt": new Date()
            }
          },
          { new: true }
        );

        if (updatedAssignment) {
          console.log("Assignment solutions updated with new grade");
        } else {
          console.log("No matching solution found in assignment to update");
        }
      } catch (updateError) {
        console.log("Note: Could not update assignment solutions:", updateError.message);
      }
    }

    console.log("Grade updated successfully:", updatedGrade._id);

    return res.status(200).json({
      message: "Grade updated successfully",
      grade: updatedGrade
    });

  } catch (error) {

    if (error.name === 'CastError') {
      return res.status(400).json({
        message: "Invalid data format provided"
      });
    }

    if (error.name === 'ValidationError') {
      const errors = {};
      for (let field in error.errors) {
        errors[field] = error.errors[field].message;
      }
      return res.status(400).json({
        message: "Validation failed",
        errors: errors
      });
    }

    return res.status(500).json({
      message: "Internal server error while updating grade",
      error: process.env.NODE_ENV === 'development' ? error.message : "Something went wrong"
    });
  }
};
 
module.exports = {
  createGrade,
  getGrades,
  getGradesByStudentId,
  getGradeById,
  updateGradeById
};