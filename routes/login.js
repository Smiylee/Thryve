import express from 'express'
import fs from 'fs'
import bcrypt from 'bcryptjs'


import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const router = express.Router()

router.get('/login/admin',(req,res)=> {
    res.render("login_admin",{error: ""})
})
router.post("/login/admin", async (req,res)=> {
       try {

           const {username,password} = req.body;
           const user  = await prisma.admin.findFirst({where : {username} }) 
           if (!user) {return res.render("login_admin"), {error: "User Not Found"}}

           const isPasswordValid = bcrypt.compare(password, user.password);
           
           if (!isPasswordValid) {
            return res.render("login_admin"), {error: "Password Wrong"}
        } 
                   

            
        //  res.redirecr('/admin/dashboard');
        req.session.admin = {username, id: user.id}
        res.redirect('/admin/dashboard')
        // res.render("admin-dashboard",{user, error: ""})

       }  catch(err) {
        res.status(500).render("login_admin",{error: err.message})
       }
})

router.get('/login/nurse',(req,res)=> {
    res.render("login_nurse", {error: ""})
})




router.post("/login/nurse", async (req,res)=> {
    try {
        const {username,password} = req.body;
        const name = username
        const user  =  await prisma.nurse.findFirst({where : {name} }) 
        if (!user) {return res.render("login_nurse", {error: "User Not Found"})}
        const isPasswordValid = password === user.password;
        if (!isPasswordValid) {return res.render("login_nurse", {error: "Invalid Password"})}

        req.session.nurse = {name, id: user.id}
        await prisma.shift.create({
            data: {
                nurse: {connect: {id: user.id}},
                nurseName: user.name,
                startTime: new Date(),
                endTime: null
            }
        })
        res.render("nurse-dashboard",{user, error: ""})
    } catch (err) {
       res.status(500).render("login_nurse",{error: err.message})
    }
})



export default router
