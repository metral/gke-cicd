package main

import (
	"fmt"

	"github.com/gin-gonic/gin"
)

func GetRoot(c *gin.Context) {
	fmt.Fprintf(c.Writer, "Hello World")
}

func main() {
	router := gin.Default()
	router.GET("/", GetRoot)
	router.Run(":80")
}
