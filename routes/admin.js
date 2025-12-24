import express from 'express'
import fs from 'fs'


import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const router = express.Router()

router.get("/dashboard", (req,res)=> {
    res.render("admin-dashboard")
})

router.get("/nurses", async (req,res)=> {
    const nurses = await prisma.nurse.findMany();
    res.render("nurses",{nurses})
})

router.get("/add/nurse", (req,res) => {
    res.render("add-nurse")
})

router.post("/add/nurses",  async (req,res)=> {
    const {name,email,password,confirmPassword} = req.body;
    if(password !== confirmPassword){
        return res.render("add-nurse", {error: "Passwords do not match"})
    }
    try {
        await prisma.nurse.create({
            data: {
                name,
                email,
                password
            }
        })
        res.redirect("/admin/nurses")
    } catch (error) {
        res.render("add-nurse", {error: "Error creating nurse"})
    }
   
})

export default router