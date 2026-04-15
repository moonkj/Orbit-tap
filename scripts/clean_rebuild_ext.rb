#!/usr/bin/env ruby
require 'xcodeproj'

project_path = File.join(__dir__, '..', 'ios', 'Runner.xcodeproj')
project = Xcodeproj::Project.open(project_path)

ext_target = project.targets.find { |t| t.name == 'SwiftSafariExtension' }
runner_target = project.targets.find { |t| t.name == 'Runner' }

# === NUCLEAR CLEANUP: remove ALL build files from extension ===
ext_target.source_build_phase.clear
ext_target.resources_build_phase.clear

# Remove stale SwiftSafariExtension groups and duplicate file refs
project.main_group.children.select { |c|
  c.respond_to?(:name) && c.name == 'SwiftSafariExtension'
}.each { |g| g.remove_from_project }

# Remove ALL orphaned file references for SafariWebExtensionHandler
project.objects.select { |o|
  o.is_a?(Xcodeproj::Project::Object::PBXFileReference) &&
  o.display_name == 'SafariWebExtensionHandler.swift'
}.each { |r| r.remove_from_project }

# Remove orphaned Resources folder refs
project.objects.select { |o|
  o.is_a?(Xcodeproj::Project::Object::PBXFileReference) &&
  o.display_name == 'Resources' &&
  o.last_known_file_type == 'folder'
}.each { |r| r.remove_from_project }

# Remove stale build files from Runner that reference extension files
runner_target.source_build_phase.files.select { |f|
  ref = f.file_ref
  next false unless ref
  name = ref.display_name rescue nil
  name == 'SafariWebExtensionHandler.swift'
}.each { |f| runner_target.source_build_phase.remove_build_file(f) }

# Now create clean extension group
ext_group = project.main_group.new_group('SwiftSafariExtension', 'SwiftSafariExtension')

# Add SafariWebExtensionHandler.swift
handler_ref = ext_group.new_file('SafariWebExtensionHandler.swift')
ext_target.source_build_phase.add_file_reference(handler_ref)

# Add AppGroupConstants to extension (use existing ref from Runner)
agc_ref = project.objects.find { |o|
  o.is_a?(Xcodeproj::Project::Object::PBXFileReference) &&
  o.uuid == 'AABB0004AABB0004AABB0004'
}
ext_target.source_build_phase.add_file_reference(agc_ref) if agc_ref

# Add Resources as folder reference
res_ref = project.new_file('SwiftSafariExtension/Resources', :built_products)
# Override to be a folder reference in the project
res_ref.source_tree = '<group>'
res_ref.path = 'SwiftSafariExtension/Resources'
res_ref.last_known_file_type = 'folder'
res_ref.set_explicit_file_type('folder')
ext_group.children << res_ref
ext_target.resources_build_phase.add_file_reference(res_ref)

project.save

# Verify
project = Xcodeproj::Project.open(project_path)
ext = project.targets.find { |t| t.name == 'SwiftSafariExtension' }
puts "=== Final State ==="
puts "Extension Sources: #{ext.source_build_phase.files.count}"
ext.source_build_phase.files.each { |f| puts "  - #{f.file_ref&.display_name}" }
puts "Extension Resources: #{ext.resources_build_phase.files.count}"
ext.resources_build_phase.files.each { |f| puts "  - #{f.file_ref&.display_name} (#{f.file_ref&.path})" }
