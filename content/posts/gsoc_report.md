+++
title="GSoC Final Report"
date=2021-08-19

[taxonomies]
categories = ["GSoC"]
tags = ["GSoC", "rust"]

[extra]
toc = true
+++

Recently, I was selected as GSoC student with CCExtractor for the rewrite in rust project. For the past few months I have been working on it, and here is the final report...

<!-- more -->

<img id="gsoc" src="/images/logos.jpg" alt="GSoC logo"> 

# Introduction 
This Project involves rewriting/porting the CEA-708 decoder to rust. CEA-708 is the standard for closed captioning for ATSC digital television (DTV) streams in the US and a few other countries. 

# Project Details
Organisation:- [CCExtractor](https://summerofcode.withgoogle.com/organizations/5433564985819136/)

Project:- [Rewrite 708 decoder in Rust](https://summerofcode.withgoogle.com/projects/#5980303367077888)

Source Code:- <https://github.com/CCExtractor/ccextractor>

# Project Milestones

- Improve timing to be in sync with the samples.
- Perfect rendering, limited only by the output format.
- Full support to all languages for which samples are available.
- Improve the documentation of the code, using rustdoc.
- Implement testing using rust’s inbuilt testing features.

# PRs
- Rust rewrite
    - [#1350](https://github.com/CCExtractor/ccextractor/pulls/1350) - Update function declarations and naming style
    - [#1351](https://github.com/CCExtractor/ccextractor/pulls/1351) - Add rust library
    - [#1353](https://github.com/CCExtractor/ccextractor/pulls/1353) - Update cmake for unix platforms
    - [#1355](https://github.com/CCExtractor/ccextractor/pulls/1355) - Add CI and docs for rust lib
    - [#1358](https://github.com/CCExtractor/ccextractor/pulls/1358) - Add functions to rust
    - [#1360](https://github.com/CCExtractor/ccextractor/pulls/1360) - Add few commands and refactor the code
    - [#1361](https://github.com/CCExtractor/ccextractor/pulls/1361) - Added DSW, DFx, some C0 and extended commands
    - [#1363](https://github.com/CCExtractor/ccextractor/pulls/1363) - Add Pen Presets and timing functions
    - [#1364](https://github.com/CCExtractor/ccextractor/pulls/1364) - Add tv_screen module, copy to screen and other functions
    - [#1368](https://github.com/CCExtractor/ccextractor/pulls/1368) - Added srt writer
    - [#1372](https://github.com/CCExtractor/ccextractor/pulls/1372) - Add writers for transcripts and SAMI
    - [#1374](https://github.com/CCExtractor/ccextractor/pulls/1374) - Update documentation

- Improve timing
    - [#1319](https://github.com/CCExtractor/ccextractor/pulls/1319) - Fix 708 timing issue
    
- Bug fixes
    - [#1304](https://github.com/CCExtractor/ccextractor/pulls/1304) - Ignore extra padding data in the current_packet
    - [#1325](https://github.com/CCExtractor/ccextractor/pulls/1325) - Revert #1304
    - [#1338](https://github.com/CCExtractor/ccextractor/pulls/1338) - Fix min and max fts when PTS resets
    - [#1342](https://github.com/CCExtractor/ccextractor/pulls/1342) - Fix timing zero-ing out, when Direct Rollup is selected
    - [#1344](https://github.com/CCExtractor/ccextractor/pulls/1344) - Fix for missing subtitles
    - [#1345](https://github.com/CCExtractor/ccextractor/pulls/1345) - Fix column length
    - [#1356](https://github.com/CCExtractor/ccextractor/pulls/1356) - Update win_iconv path

# Implementation

## FFI

Initial work started with creating FFI(Foreign Function Interface) bindings for C code. FFI allows rust code to interact with other languages. I used [rust-bindgen](https://github.com/rust-lang/rust-bindgen) which automatically generates Rust FFI bindings to C code. 

rust-bindgen requires a header file for which bindings are to be generated. 
```C
// wrapper.h 
#include "../lib_ccx/ccx_decoders_708.h"
#include "../lib_ccx/ccx_decoders_common.h"
#include "../lib_ccx/ccx_dtvcc.h"
#include "../lib_ccx/ccx_decoders_708_output.h"
#include "../lib_ccx/ccx_decoders_708_encoding.h"
#include "../lib_ccx/ccx_common_timing.h"
#include "../lib_ccx/lib_ccx.h"
```

Then we call bindgen in a [build script](https://doc.rust-lang.org/cargo/reference/build-scripts.html) to generate the bindings.
```rust
bindgen::Builder::default()
// The input header we would like to generate
// bindings for.
.header("wrapper.h")
// Tell cargo to invalidate the built crate whenever any of the
// included header files changed.
.parse_callbacks(Box::new(bindgen::CargoCallbacks))
// Finish the builder and generate the bindings.
.generate()
// Unwrap the Result and panic on failure.
.expect("Unable to generate bindings");
```

For example, bindings for this struct
```C
typedef struct dtvcc_pen_attribs
{
    int pen_size;
    int offset;
    int text_tag;
    int font_tag;
    int edge_type;
    int underline;
    int italic;
} dtvcc_pen_attribs;
```
is generated as follows
```rust
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct dtvcc_pen_attribs {
    pub pen_size: ::std::os::raw::c_int,
    pub offset: ::std::os::raw::c_int,
    pub text_tag: ::std::os::raw::c_int,
    pub font_tag: ::std::os::raw::c_int,
    pub edge_type: ::std::os::raw::c_int,
    pub underline: ::std::os::raw::c_int,
    pub italic: ::std::os::raw::c_int,
}
```

## Decoder
Next part was to implement the 708 decoder. I used [CEA-708-E](https://shop.cta.tech/products/digital-television-dtv-closed-captioning) as a reference for the implementation. There are 5 layers in the DTVCC(digital television closed captioning) data framework. Similar to the OSI Reference Model, each of these layers provides particular services as shown:

| Layer | Description |
| ------ | ----------- |
| DTVCC Interpretation Layer   | Specification of Window appearance and content, and Synchronization of Command Interpretation to the Display of video |
| DTVCC Coding Layer | Parsing of Syntax |
| DTVCC Service Layer    | Demultiplexing of Caption Services |
| DTVCC Packet Layer  | Resynchronization of Data Stream |
| DTVCC Transport Layer  |  Extraction of closed caption data from parent transport system, e.g. MPEG user data |

<img src="/images/layers.png" alt="DTVCC Layers"> 

Interpretation layer involved parsing of the data according to different commands. Examples of some commands are DSW(Display Windows), HDW(Hide Windows), SWA(Set Window Attributes), SPC(Set Pen Color) etc.


## Improve timing
Initially, subtitles were off by about 1-2 seconds. I looked at the implementations of all commands and none seemed to be causing the issue. After lots of debugging, it turned out the problem was hiding in plain sight. CC data comes in the form of packets. We get 2 bytes of the packet at a time. Once the packet is complete, we parse it. 

The issue was in detecting if the packet is complete. Previous code was processing the packet once we get the header for next packet. This introduced a delay in packet processing thus subtitles were delayed.
```rust
// Previous Code
fn process_data(cc_data){
    if is_header() {
        process_prev_packet();
    } else {
        add_data_to_packet(cc_data);
    }
}
```

We also get the packet length in the header. So after adding the 2 bytes to the packet, we can check if the packet is complete by checking its length, without waiting for the next packet header. This improved subtitle timing a lot and reduced the delay to less than 200ms

```rust
// Current Code
fn process_data(cc_data) {
    add_data_to_packet(cc_data);
    if packet.len() == len_from_packet_header {
        process_packet();
    }
}
```

## Documentation
Rust ships with a tool called rustdoc which generates documentation for Rust projects. 
The `///` syntax , called an outer documentation, is used to document the item present after it. It is generally used for functions, enums, structs, etc.
```rust
/// This is the main function
fn main(){
    println!("Hello world!")
}
```
There is another syntax: `//!`, called an inner documentation, which is used to document the item it is present inside. It is often used when documenting the entire crate, or a module 
```rust
mod example_mod {
    //! Documentation for example_mod
}
```
Then, we can generate the documentation using the `cargo doc` command. For example, this is the documentation for my project

<img src="/images/doc.png" alt="CCExtractor documentation"> 

## Testing
CCExtractor has a [Sample Platform](https://sampleplatform.ccextractor.org/). SP contains video samples shared to CCExtractor over the years. CI was setup so that the code will be tested on all the videos available with SP.

Example of a CI run:-
<img src="/images/SP.png" alt="CCExtractor Sample Platform"> 

# Acknowledgment
I would like to thank my mentor **Carlos Fernandez** for helping and guiding me throughout the project. It was a great experience and I got to learn a lot from him. Also, thanks to CCExtractor for giving me this opportunity to work on something amazing.

I would also like to thank **Willem Van Iseghem**, for helping me with setting up the testing of rust code on the different video samples available on the [Sample Platform](https://sampleplatform.ccextractor.org/). It made the task of testing the rust code much easier.

Finally, thanks to Google for organizing such a great program that helps students from all over the world. 
