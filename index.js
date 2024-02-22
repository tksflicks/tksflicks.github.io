$(function() {
    'use strict';
    console.log($(".column").find('*'));
    var all_imgs = $(".column").find('*');
    var num_img = all_imgs.length;
    var col_len = num_img/4;
    console.log(num_img)
    console.log(col_len)
    var matrix_img = [
        all_imgs.slice(0,col_len),
        all_imgs.slice(col_len,(2*col_len)),
        all_imgs.slice(2*col_len,(3*col_len)),
        all_imgs.slice(3*col_len,(4*col_len))
    ];

    console.log(matrix_img)
    var newArray = [];
    var srcArr = [];




    for(var i = 0; i < col_len; i++){
        for(var j = 0; j < matrix_img.length; j++){
            //console.log(j)
            //console.log(matrix_img[j][i])
            newArray.push(matrix_img[j][i]);
            srcArr.push(matrix_img[j][i].currentSrc);
        };
    };  


 
    // This will execute whenever the window is resized
    console.log(window.matchMedia('screen and (max-width: 650px)').matches)
    if (window.matchMedia('screen and (max-width: 650px)').matches) {
        
        console.log("IT HPdsjf")
        newArray = all_imgs;
        for(var i = 0; i < newArray.length; i++){
            srcArr[i] = all_imgs[i].currentSrc;
        }
    }

    if (window.matchMedia('screen and (max-width: 1000px)').matches) {
        var arr1 = all_imgs.slice(0,col_len);
        var arr2 = all_imgs.slice(2*col_len,(3*col_len))
        var arr3 = all_imgs.slice(col_len,(2*col_len))
        var arr4 = all_imgs.slice(3*col_len,(4*col_len))
        var matrix_img = [
            $.merge(arr1,arr2),
            $.merge(arr3,arr4)
        ];

        newArray = [];
        srcArr = [];
        col_len = matrix_img[0].length
        console.log(matrix_img.length)

        for(var i = 0; i < col_len; i++){
            for(var j = 0; j < matrix_img.length; j++){
                //console.log(j)
                //console.log(matrix_img[j][i])
                newArray.push(matrix_img[j][i]);
                srcArr.push(matrix_img[j][i].currentSrc);
            };
        };  
    
    }


    
    console.log(newArray)
    console.log(srcArr)

    // Grid-Based Gallery
    var current_ind = 0;
    
    $(".column").find('*').each(function () {
        var drag = this;
        drag.addEventListener("click", function(e) {
            e.preventDefault();
            console.log(this.currentSrc);
            var img_ind = srcArr.indexOf(this.currentSrc)
            current_ind = img_ind;
            console.log(img_ind)
            $("#modal_img").attr("src", this.currentSrc);
            $("html").css('overflow','clip');
            $(".img-modal").css('top','0');
        });
    })

    $("#close_modal").click(function(){
        $(".img-modal").css('transition','top 0.5s');
        $(".img-modal").css('top','-100%');
        $("html").css('overflow','scroll');

    })

    $("#back_modal").click(function(){
        current_ind = current_ind -1;

        $("#modal_img").attr("src", srcArr[current_ind]);
    })

    $("#forward_modal").click(function(){
        current_ind = current_ind +1;
        $("#modal_img").attr("src", srcArr[current_ind]);
    })


          

          // Show previous image
  
          // Show next image
          

          // Closing Modal Window


      

});