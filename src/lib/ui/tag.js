import React from "react";

function Tag(props) {
    let color;
    let bg;

    switch (props.status) {
      case "done":
        color = "#0BA706";
        bg = "#E7F6E6"; break;
      case "pending":
        color = "#F3BB92"; 
        bg = "#FDF7F4";
        break;
      case "rejected":
        color = "#E03145"; 
        bg = "#FCEAEC";
        break;
      case "completed":
        color = "#A6A5A5"; 
        bg = "#F2F4F4";
        break;
      case "inProgress":
        color = "#88CBC9"; 
        bg = "#E6FAF9";
        break;
      case "created":
        color = "#963F7B"; 
        bg = "#F4ECF2";
        break;
        default: '#fff'
    }
  return (
    <>
      <span style={{backgroundColor:bg, color:color}} className={`
      px-4 py-1
      focus:outline-none 
      font-semibold
      rounded-full text-sm text-center
      inline-flex items-center mr-2 text-xs`}
        type="button">
          {props.label}
      </span>
    </>
  );
}

export default Tag;
